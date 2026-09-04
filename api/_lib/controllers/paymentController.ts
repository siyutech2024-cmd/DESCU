import type { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { getStripe } from '../lib/stripe.js';
import { HttpError, asyncHandler, badRequest, conflict, forbidden, notFound, parseBody, parseQuery, unauthorized } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { getAuthClient } from '../utils/supabaseHelper.js';
import { confirmBlockReason, isInFlight, isPaymentSettled, type OrderStatus } from '../domain/orders.js';
import { releaseEscrow } from '../services/escrowReleaseService.js';
import { transitionOrder } from '../services/orderTransitionService.js';
import { processStripeEvent } from '../services/stripeWebhookService.js';
import { ConfirmOrderSchema, CreateDisputeSchema, ListOrdersQuerySchema, ShipOrderSchema } from '../schemas/orders.js';

/** A seller may ship once the money is in (or the order is cash). */
const SHIPPABLE_STATUSES: readonly OrderStatus[] = ['paid', 'escrow_held'];

/**
 * Order lifecycle + legacy Stripe webhook handlers.
 * Stripe Connect onboarding / payment-intent creation live in controllers/stripeController.ts.
 */

const notify = (orderId: string, event: string, meta?: Record<string, unknown>) => {
    import('../services/orderNotificationService.js')
        .then(({ notifyOrderStatus }) => notifyOrderStatus(orderId, event, meta).catch(console.error))
        .catch(console.error);
};

// Mark as Shipped (seller only)
export const markOrderAsShipped = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { orderId, carrier, trackingNumber } = parseBody(ShipOrderSchema, req.body);

    // 1. Verify Ownership (Must be SELLER) and that the order is actually paid & shippable
    const { data: order } = await supabase
        .from('orders')
        .select('seller_id, status, order_type, payment_method, payment_captured, escrow_status')
        .eq('id', orderId)
        .maybeSingle();

    if (!order) throw notFound('Order not found');
    if (order.seller_id !== userId) throw forbidden('Only seller can mark shipped');
    if (order.order_type !== 'shipping') throw badRequest('Not a shipping order');
    if (!SHIPPABLE_STATUSES.includes(order.status as OrderStatus) || !isPaymentSettled(order)) {
        throw badRequest(`Order cannot be shipped in status "${order.status}"`);
    }

    const outcome = await transitionOrder({
        orderId,
        from: order.status as OrderStatus,
        to: 'shipped',
        patch: { shipping_carrier: carrier ?? null, tracking_number: trackingNumber ?? null },
        timeline: {
            event_type: 'shipped',
            description: `Shipped${carrier ? ` via ${carrier}` : ''}${trackingNumber ? ` (${trackingNumber})` : ''}`,
            created_by: userId,
            metadata: { carrier: carrier ?? null, tracking_number: trackingNumber ?? null },
        },
        select: 'id, status',
    });
    if (!outcome.ok) throw new HttpError(outcome.code, outcome.error);

    notify(orderId, 'shipped', { carrier, trackingNumber });
    res.json({ success: true, order: outcome.order });
});

// Confirm Receipt & Release Funds from Escrow (buyer only)
export const confirmOrder = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { orderId } = parseBody(ConfirmOrderSchema, req.body);

    // 1. Get Order & Verify Ownership (Must be BUYER)
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) throw notFound('Order not found');
    if (order.buyer_id !== userId) throw forbidden('Only buyer can confirm receipt');

    // Never release funds for an order whose payment was not actually captured.
    const blocked = confirmBlockReason(order);
    if (blocked) throw badRequest(blocked);

    const outcome = await releaseEscrow(order, {
        actorId: userId,
        source: 'buyer_confirm',
        description: undefined,
    });
    if (!outcome.ok) throw new HttpError(outcome.code, outcome.error);

    res.json({
        success: true,
        status: outcome.status,
        transferId: outcome.transferId,
        transferAmount: outcome.transferAmount,
        platformFee: outcome.platformFee,
    });
});

// Create Dispute (either party, while goods/money are in flight)
export const createDispute = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { orderId, reason, description } = parseBody(CreateDisputeSchema, req.body);

    // 1. Verify Ownership & Eligibility
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) throw notFound('Order not found');
    if (order.buyer_id !== userId && order.seller_id !== userId) throw forbidden('Not authorized for this order');
    // Disputes only make sense while money/goods are in flight.
    if (!isInFlight(order.status)) throw badRequest(`Order cannot be disputed in status "${order.status}"`);

    const { data: existingDispute } = await supabase
        .from('disputes').select('id').eq('order_id', orderId).in('status', ['open', 'resolving']).maybeSingle();
    if (existingDispute) throw conflict('An open dispute already exists for this order');

    // 2. Create Dispute
    const { data: dispute, error: disputeError } = await supabase
        .from('disputes')
        .insert({ order_id: orderId, status: 'open', reason, description, created_by: userId })
        .select()
        .single();
    if (disputeError) throw disputeError;

    // 3. Update Order Status — conditional on the status we validated, so a confirm
    //    that finished in between cannot be flipped back to 'disputed'.
    const flagged = await transitionOrder({
        orderId,
        from: order.status,
        to: 'disputed',
        timeline: { event_type: 'dispute_opened', description: reason, created_by: userId, metadata: { dispute_id: dispute.id } },
        select: 'id',
    });
    if (!flagged.ok) {
        await supabase.from('disputes').update({ status: 'dismissed', admin_note: 'Order changed state while the dispute was being opened' }).eq('id', dispute.id);
        throw new HttpError(flagged.code, flagged.error);
    }

    notify(orderId, 'disputed', { reason });
    res.json({ success: true, disputeId: dispute.id });
});

// Get User Orders (Buyer or Seller)
const ORDER_PRODUCT_COLUMNS = 'products(id, title, images, price, currency, status)';

export const getUserOrders = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const authHeader = req.headers.authorization;
    if (!authHeader) throw unauthorized('Unauthorized: Missing credentials');

    const { role, limit, offset } = parseQuery(ListOrdersQuerySchema, req.query);

    // Use the caller's own JWT so RLS applies.
    const client = getAuthClient(authHeader);

    let query = client.from('orders').select(`*, ${ORDER_PRODUCT_COLUMNS}`);
    if (role === 'seller') {
        query = query.eq('seller_id', userId);
    } else if (role === 'buyer') {
        query = query.eq('buyer_id', userId);
    } else {
        query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    }

    const { data: orders, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({ orders: orders || [] });
});

/**
 * Verify a Stripe webhook signature. Answers 400 itself on failure (Stripe expects a
 * non-2xx so it retries) and returns null so the caller can bail out.
 */
export const verifyStripeSignature = (req: Request, res: Response, tag: string) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret || typeof sig !== 'string') {
        // Fail closed: an unsigned payload must never be able to mark orders as paid.
        console.error(`[${tag}] Webhook rejected: missing STRIPE_WEBHOOK_SECRET or stripe-signature header`);
        res.status(400).json({ error: 'Webhook signature required' });
        return null;
    }
    try {
        return getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`[${tag}] Signature verification failed: ${err.message}`);
        res.status(400).json({ error: 'Webhook signature verification failed' });
        return null;
    }
};

/** Legacy webhook URL (POST /api/payment/webhook). Processing errors → 500 via asyncHandler so Stripe retries. */
export const handleStripeWebhook = asyncHandler(async (req, res) => {
    const event = verifyStripeSignature(req, res, 'Webhook');
    if (!event) return;
    const outcome = await processStripeEvent(event, 'legacy');
    res.json({ received: true, outcome });
});
