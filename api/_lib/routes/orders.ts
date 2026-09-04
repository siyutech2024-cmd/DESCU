import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import {
    ORDER_PAYMENT_WINDOW_MS,
    computeOrderAmounts,
    confirmBlockReason,
    initialOrderStatus,
    isOrderStatus,
    isOrderType,
    isPaymentMethod,
} from '../domain/orders.js';
import { requireAuth } from '../middleware/userAuth.js';
import { releaseEscrow } from '../services/escrowReleaseService.js';
import { cancelOrder, transitionOrder } from '../services/orderTransitionService.js';
import {
    markOrderAsShipped,
    confirmOrder,
    createDispute,
    getUserOrders
} from '../controllers/paymentController.js';

/**
 * Order lifecycle routes.
 *
 * NOTE: GET /api/orders is served by paymentController.getUserOrders (it was
 * registered first in the original monolith, so an inline duplicate that
 * followed it was unreachable and has been removed).
 */
export const ordersRouter = Router();
const router = ordersRouter;

router.post('/api/orders/ship', requireAuth, markOrderAsShipped);
router.post('/api/orders/confirm', requireAuth, confirmOrder);
router.get('/api/orders', requireAuth, getUserOrders);
router.post('/api/disputes', requireAuth, createDispute);

router.post('/api/orders/create', requireAuth, async (req: any, res) => {
    try {
        const { productId, orderType, paymentMethod, shippingAddress, meetupLocation, meetupTime } = req.body;
        const buyerId = req.user.id;

        if (!isOrderType(orderType) || !isPaymentMethod(paymentMethod)) {
            return res.status(400).json({ error: 'Invalid orderType or paymentMethod' });
        }
        if (typeof productId !== 'string' || !productId) {
            return res.status(400).json({ error: 'productId is required' });
        }
        if (orderType === 'shipping' && !shippingAddress) {
            return res.status(400).json({ error: 'Shipping address is required for shipping orders' });
        }

        const { data: product, error: pInfoError } = await supabase
            .from('products')
            .select('id, seller_id, price, status, deleted_at')
            .eq('id', productId)
            .maybeSingle();
        if (pInfoError) throw pInfoError;
        if (!product) return res.status(404).json({ error: 'Product not found' });
        if (product.status !== 'active' || product.deleted_at) {
            return res.status(400).json({ error: 'Product is not available for purchase' });
        }
        if (product.seller_id === buyerId) return res.status(400).json({ error: 'Cannot buy your own product' });

        const { productAmount, shippingFee, platformFee, totalAmount } = computeOrderAmounts(Number(product.price), orderType, paymentMethod);

        const orderData: any = {
            product_id: productId, buyer_id: buyerId, seller_id: product.seller_id,
            order_type: orderType, payment_method: paymentMethod,
            product_amount: productAmount, shipping_fee: shippingFee, platform_fee: platformFee, total_amount: totalAmount,
            currency: 'MXN', status: initialOrderStatus(paymentMethod),
            expires_at: new Date(Date.now() + ORDER_PAYMENT_WINDOW_MS)
        };
        if (orderType === 'shipping') orderData.shipping_address = shippingAddress;
        if (orderType === 'meetup' && meetupLocation) {
            orderData.meetup_location = meetupLocation; orderData.meetup_time = meetupTime;
        }

        const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
        if (orderError) throw orderError;

        await supabase.from('order_timeline').insert({
            order_id: order.id, event_type: 'created', description: `Order Created (${orderType})`, created_by: buyerId, metadata: { orderType, paymentMethod }
        });

        // Auto-create chat
        const { data: conversation } = await supabase.from('conversations').select('id').eq('product_id', productId)
            .or(`and(user1_id.eq.${buyerId},user2_id.eq.${product.seller_id}),and(user1_id.eq.${product.seller_id},user2_id.eq.${buyerId})`)
            .limit(1).maybeSingle();
        if (!conversation) {
            await supabase.from('conversations').insert({ product_id: productId, user1_id: buyerId, user2_id: product.seller_id });
        }

        // 🔔 发送订单创建通知到聊天
        import('../services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(order.id, 'created').catch((err: any) => {
                console.error('[CreateOrder] Failed to send notification:', err);
            });
        }).catch(console.error);

        res.json({ order, success: true, requiresPayment: paymentMethod === 'online' });
    } catch (error: any) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order', message: error.message });
    }
});

router.get('/api/orders/:id', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { data: order, error } = await supabase.from('orders')
            .select('*, product:products(*), buyer:users!buyer_id(id, name, avatar_url), seller:users!seller_id(id, name, avatar_url), timeline:order_timeline(*)')
            .eq('id', id).single();

        if (error || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId && order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        res.json({ order });
    } catch (error: any) {
        console.error('Get order detail error:', error);
        res.status(500).json({ error: 'Failed to get order', message: error.message });
    }
});

router.post('/api/orders/:id/confirm', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const isBuyer = order.buyer_id === userId;
        const isSeller = order.seller_id === userId;
        if (!isBuyer && !isSeller) return res.status(403).json({ error: 'Unauthorized' });

        // Never let an unpaid / cancelled / disputed order be "completed" by two confirmations.
        const blocked = confirmBlockReason(order);
        if (blocked) return res.status(400).json({ error: blocked });

        const updateData: any = {};
        if (isBuyer && !order.buyer_confirmed_at) updateData.buyer_confirmed_at = new Date().toISOString();
        if (isSeller && !order.seller_confirmed_at) updateData.seller_confirmed_at = new Date().toISOString();

        if (Object.keys(updateData).length === 0) return res.json({ message: 'Already confirmed', order });

        const { data: updatedOrder, error } = await supabase.from('orders').update(updateData).eq('id', id).select().single();
        if (error) throw error;

        await supabase.from('order_timeline').insert({
            order_id: id, event_type: isBuyer ? 'buyer_confirmed' : 'seller_confirmed', description: `${isBuyer ? 'Buyer' : 'Seller'} confirmed`, created_by: userId
        });

        // 🔔 发送确认通知
        import('../services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(id, isBuyer ? 'buyer_confirmed' : 'seller_confirmed', { confirmedBy: isBuyer ? 'buyer' : 'seller' }).catch(console.error);
        }).catch(console.error);

        if (updatedOrder.buyer_confirmed_at && updatedOrder.seller_confirmed_at) {
            // Both parties confirmed: complete the order through the shared release path so an
            // online payment is actually transferred (or queued for manual payout) — never
            // just stamped 'completed' with the money still in escrow.
            const outcome = await releaseEscrow(updatedOrder, {
                actorId: userId,
                source: 'dual_confirm',
                description: 'Both parties confirmed — order completed',
            });
            if (!outcome.ok) return res.status(outcome.code).json({ error: outcome.error });

            const { data: completedOrder } = await supabase.from('orders').select('*').eq('id', id).single();
            return res.json({ message: 'Order Completed', order: completedOrder, completed: true, release: outcome });
        }

        res.json({ message: 'Confirmed, waiting for other party', order: updatedOrder, completed: false });
    } catch (error: any) {
        console.error('Confirm order error:', error);
        res.status(500).json({ error: 'Failed to confirm', message: error.message });
    }
});

router.post('/api/orders/:id/arrange-meetup', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { location, time, lat, lng } = req.body;
        const userId = req.user.id;

        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId && order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (order.order_type !== 'meetup') return res.status(400).json({ error: 'Not a meetup order' });

        if (typeof location !== 'string' || !location.trim()) return res.status(400).json({ error: 'location is required' });
        if (!isOrderStatus(order.status)) return res.status(400).json({ error: `Unknown order status "${order.status}"` });

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
            if (!data?.length) return res.status(409).json({ error: 'Order changed state; please reload and try again' });
            updatedOrder = data[0];
            await supabase.from('order_timeline').insert({ order_id: id, ...timeline });
        } else {
            // paid / escrow_held / meetup_arranged → meetup_arranged; anything else is rejected by the state machine.
            const outcome = await transitionOrder({ orderId: id, from: order.status, to: 'meetup_arranged', patch: meetupPatch, timeline });
            if (!outcome.ok) {
                const message = outcome.code === 400 ? `Cannot arrange a meetup for an order in status "${order.status}"` : outcome.error;
                return res.status(outcome.code).json({ error: message });
            }
            updatedOrder = outcome.order;
        }

        // 🔔 发送见面安排通知
        import('../services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(id, 'meetup_arranged', { location, time }).catch(console.error);
        }).catch(console.error);
        res.json({ order: updatedOrder });
    } catch (error: any) {
        console.error('Arrange meetup error:', error);
        res.status(500).json({ error: 'Failed to arrange meetup', message: error.message });
    }
});

/**
 * Cancel an order. Buyer: unpaid online orders. Either party: cash orders not yet completed.
 * Paid online orders cannot be cancelled here — the buyer opens a dispute instead.
 */
router.post('/api/orders/:id/cancel', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId: string = req.user.id;
        const { data: order, error } = await supabase.from('orders')
            .select('id, status, buyer_id, seller_id, product_id, payment_method, payment_captured')
            .eq('id', id).maybeSingle();
        if (error?.code === '22P02') return res.status(404).json({ error: 'Order not found' });
        if (error) throw error;
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const outcome = await cancelOrder({ order, actorId: userId, reason: req.body?.reason });
        if (!outcome.ok) return res.status(outcome.code).json({ error: outcome.error });

        import('../services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(id, 'cancelled').catch(console.error);
        }).catch(console.error);
        res.json({ success: true, order: outcome.order });
    } catch (error: any) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Failed to cancel order', message: error.message });
    }
});
