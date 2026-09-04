import { supabase } from '../db/supabase.js';
import {
    ORDER_PAYMENT_WINDOW_MS,
    computeOrderAmounts,
    confirmBlockReason,
    initialOrderStatus,
    isOrderStatus,
} from '../domain/orders.js';
import { HttpError, asyncHandler, badRequest, conflict, forbidden, notFound, parseBody, parseParams } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { releaseEscrow } from '../services/escrowReleaseService.js';
import { cancelOrder as cancelOrderTransition, transitionOrder } from '../services/orderTransitionService.js';
import {
    ArrangeMeetupSchema,
    CancelOrderSchema,
    CreateOrderSchema,
    UuidParamSchema,
} from '../schemas/orders.js';

/**
 * Order lifecycle handlers (create / detail / dual-confirm / meetup / cancel).
 * Ship, buyer-confirm, disputes and the order list live in paymentController.ts.
 */

/** Fire-and-forget chat notification; failures are logged, never surfaced to the client. */
const notify = (orderId: string, event: string, meta?: Record<string, unknown>) => {
    import('../services/orderNotificationService.js')
        .then(({ notifyOrderStatus }) =>
            notifyOrderStatus(orderId, event, meta).catch((err: unknown) => {
                console.error(`[Orders] Failed to send "${event}" notification for ${orderId}:`, err);
            }))
        .catch(console.error);
};

export const createOrder = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { productId, orderType, paymentMethod, shippingAddress, meetupLocation, meetupTime } = parseBody(CreateOrderSchema, req.body);
    const buyerId = req.user!.id;

    const { data: product, error: pInfoError } = await supabase
        .from('products')
        .select('id, seller_id, price, status, deleted_at')
        .eq('id', productId)
        .maybeSingle();
    if (pInfoError) throw pInfoError;
    if (!product) throw notFound('Product not found');
    if (product.status !== 'active' || product.deleted_at) throw badRequest('Product is not available for purchase');
    if (product.seller_id === buyerId) throw badRequest('Cannot buy your own product');

    const { productAmount, shippingFee, platformFee, totalAmount } = computeOrderAmounts(Number(product.price), orderType, paymentMethod);

    const orderData: Record<string, unknown> = {
        product_id: productId, buyer_id: buyerId, seller_id: product.seller_id,
        order_type: orderType, payment_method: paymentMethod,
        product_amount: productAmount, shipping_fee: shippingFee, platform_fee: platformFee, total_amount: totalAmount,
        currency: 'MXN', status: initialOrderStatus(paymentMethod),
        expires_at: new Date(Date.now() + ORDER_PAYMENT_WINDOW_MS),
    };
    if (orderType === 'shipping') orderData.shipping_address = shippingAddress;
    if (orderType === 'meetup' && meetupLocation) {
        orderData.meetup_location = meetupLocation;
        orderData.meetup_time = meetupTime;
    }

    const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
    if (orderError) throw orderError;

    await supabase.from('order_timeline').insert({
        order_id: order.id, event_type: 'created', description: `Order Created (${orderType})`, created_by: buyerId, metadata: { orderType, paymentMethod },
    });

    // Auto-create chat (buyer ↔ seller for this product) and post the "order created" card into it.
    let conversationId: string | null = null;
    const { data: conversation } = await supabase.from('conversations').select('id').eq('product_id', productId)
        .or(`and(user1_id.eq.${buyerId},user2_id.eq.${product.seller_id}),and(user1_id.eq.${product.seller_id},user2_id.eq.${buyerId})`)
        .limit(1).maybeSingle();
    if (conversation) {
        conversationId = conversation.id;
    } else {
        const { data: created } = await supabase.from('conversations')
            .insert({ product_id: productId, user1_id: buyerId, user2_id: product.seller_id })
            .select('id').single();
        conversationId = created?.id ?? null;
    }

    notify(order.id, 'created');

    res.json({ order, success: true, requiresPayment: paymentMethod === 'online', conversationId });
});

export const getOrder = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { id } = parseParams(UuidParamSchema, req.params);
    const userId = req.user!.id;

    // buyer_id/seller_id reference auth.users, so PostgREST cannot embed public.users — look them up separately.
    const { data: order, error } = await supabase.from('orders')
        .select('*, product:products(*), timeline:order_timeline(*)')
        .eq('id', id).maybeSingle();
    if (error) throw error;
    if (!order) throw notFound('Order not found');
    if (order.buyer_id !== userId && order.seller_id !== userId) throw forbidden('Unauthorized');

    const { data: people } = await supabase.from('users').select('id, name, avatar_url').in('id', [order.buyer_id, order.seller_id]);
    const byId = new Map((people ?? []).map(u => [u.id, u]));
    res.json({ order: { ...order, buyer: byId.get(order.buyer_id) ?? null, seller: byId.get(order.seller_id) ?? null } });
});

/** Dual confirmation: each party confirms once; when both have, the order completes through the escrow release path. */
export const confirmOrderByParty = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { id } = parseParams(UuidParamSchema, req.params);
    const userId = req.user!.id;

    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    if (!order) throw notFound('Order not found');

    const isBuyer = order.buyer_id === userId;
    const isSeller = order.seller_id === userId;
    if (!isBuyer && !isSeller) throw forbidden('Unauthorized');

    // Never let an unpaid / cancelled / disputed order be "completed" by two confirmations.
    const blocked = confirmBlockReason(order);
    if (blocked) throw badRequest(blocked);

    const updateData: Record<string, string> = {};
    if (isBuyer && !order.buyer_confirmed_at) updateData.buyer_confirmed_at = new Date().toISOString();
    if (isSeller && !order.seller_confirmed_at) updateData.seller_confirmed_at = new Date().toISOString();

    if (Object.keys(updateData).length === 0) return res.json({ message: 'Already confirmed', order });

    const { data: updatedOrder, error } = await supabase.from('orders').update(updateData).eq('id', id).select().single();
    if (error) throw error;

    const party = isBuyer ? 'buyer' : 'seller';
    await supabase.from('order_timeline').insert({
        order_id: id, event_type: `${party}_confirmed`, description: `${isBuyer ? 'Buyer' : 'Seller'} confirmed`, created_by: userId,
    });
    notify(id, `${party}_confirmed`, { confirmedBy: party });

    if (updatedOrder.buyer_confirmed_at && updatedOrder.seller_confirmed_at) {
        // Both parties confirmed: complete the order through the shared release path so an
        // online payment is actually transferred (or queued for manual payout) — never
        // just stamped 'completed' with the money still in escrow.
        const outcome = await releaseEscrow(updatedOrder, {
            actorId: userId,
            source: 'dual_confirm',
            description: 'Both parties confirmed — order completed',
        });
        if (!outcome.ok) throw new HttpError(outcome.code, outcome.error);

        const { data: completedOrder } = await supabase.from('orders').select('*').eq('id', id).single();
        return res.json({ message: 'Order Completed', order: completedOrder, completed: true, release: outcome });
    }

    res.json({ message: 'Confirmed, waiting for other party', order: updatedOrder, completed: false });
});

export const arrangeMeetup = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { id } = parseParams(UuidParamSchema, req.params);
    const { location, time, lat, lng } = parseBody(ArrangeMeetupSchema, req.body);
    const userId = req.user!.id;

    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    if (!order) throw notFound('Order not found');
    if (order.buyer_id !== userId && order.seller_id !== userId) throw forbidden('Unauthorized');
    if (order.order_type !== 'meetup') throw badRequest('Not a meetup order');
    if (!isOrderStatus(order.status)) throw badRequest(`Unknown order status "${order.status}"`);

    const meetupPatch = {
        meetup_location: location, meetup_time: time ?? null, meetup_location_lat: lat ?? null, meetup_location_lng: lng ?? null,
        meetup_confirmed_by_buyer: false, meetup_confirmed_by_seller: false,
    };
    const timeline = {
        event_type: 'meetup_arranged', description: `Meetup Arranged: ${location}`, created_by: userId, metadata: { location, time },
    };

    let updatedOrder: Record<string, any>;
    if (order.status === 'pending_payment') {
        // Unpaid online order: keep the meetup details but stay in pending_payment until the money arrives.
        const { data, error } = await supabase.from('orders')
            .update({ ...meetupPatch, updated_at: new Date().toISOString() })
            .eq('id', id).eq('status', 'pending_payment').select();
        if (error) throw error;
        if (!data?.length) throw conflict('Order changed state; please reload and try again');
        updatedOrder = data[0];
        await supabase.from('order_timeline').insert({ order_id: id, ...timeline });
    } else {
        // paid / escrow_held / meetup_arranged → meetup_arranged; anything else is rejected by the state machine.
        const outcome = await transitionOrder({ orderId: id, from: order.status, to: 'meetup_arranged', patch: meetupPatch, timeline });
        if (!outcome.ok) {
            const message = outcome.code === 400 ? `Cannot arrange a meetup for an order in status "${order.status}"` : outcome.error;
            throw new HttpError(outcome.code, message);
        }
        updatedOrder = outcome.order;
    }

    notify(id, 'meetup_arranged', { location, time });
    res.json({ order: updatedOrder });
});

/**
 * Cancel an order. Buyer: unpaid online orders. Either party: cash orders not yet completed.
 * Paid online orders cannot be cancelled here — the buyer opens a dispute instead.
 */
export const cancelOrder = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { id } = parseParams(UuidParamSchema, req.params);
    const { reason } = parseBody(CancelOrderSchema, req.body);
    const userId = req.user!.id;

    const { data: order, error } = await supabase.from('orders')
        .select('id, status, buyer_id, seller_id, product_id, payment_method, payment_captured, stripe_payment_intent_id')
        .eq('id', id).maybeSingle();
    if (error) throw error;
    if (!order) throw notFound('Order not found');

    const outcome = await cancelOrderTransition({ order, actorId: userId, reason });
    if (!outcome.ok) throw new HttpError(outcome.code, outcome.error);

    notify(id, 'cancelled');
    res.json({ success: true, order: outcome.order });
});
