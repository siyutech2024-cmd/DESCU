import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { getStripe } from '../lib/stripe.js';
import { AuthenticatedRequest } from '../middleware/userAuth.js';
import { getAuthClient } from '../utils/supabaseHelper.js';
import { confirmBlockReason, isPaymentSettled } from '../domain/orders.js';
import { releaseEscrow } from '../services/escrowReleaseService.js';
import { processStripeEvent } from '../services/stripeWebhookService.js';

/**
 * Order lifecycle + legacy Stripe webhook handlers.
 * Stripe Connect onboarding / payment-intent creation live in routes/stripe.ts (v2 endpoints).
 */

// Mark as Shipped
export const markOrderAsShipped = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const { orderId, carrier, trackingNumber } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Verify Ownership (Must be SELLER) and that the order is actually paid & shippable
        const { data: order } = await supabase
            .from('orders')
            .select('seller_id, status, order_type, payment_method, payment_captured, escrow_status')
            .eq('id', orderId)
            .maybeSingle();

        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.seller_id !== userId) return res.status(403).json({ error: 'Only seller can mark shipped' });
        if (order.order_type !== 'shipping') return res.status(400).json({ error: 'Not a shipping order' });
        if (!['paid', 'escrow_held'].includes(order.status) || !isPaymentSettled(order)) {
            return res.status(400).json({ error: `Order cannot be shipped in status "${order.status}"` });
        }

        const { error } = await supabase
            .from('orders')
            .update({
                status: 'shipped',
                shipping_carrier: carrier,
                tracking_number: trackingNumber,
                updated_at: new Date()
            })
            .eq('id', orderId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Confirm Receipt & Release Funds from Escrow
// This function handles the escrow release when buyer confirms receipt
export const confirmOrder = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const { orderId } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Get Order & Verify Ownership (Must be BUYER)
        const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId) return res.status(403).json({ error: 'Only buyer can confirm receipt' });

        // Never release funds for an order whose payment was not actually captured.
        const blocked = confirmBlockReason(order);
        if (blocked) return res.status(400).json({ error: blocked });

        const outcome = await releaseEscrow(order, {
            actorId: userId,
            source: 'buyer_confirm',
            description: undefined,
        });
        if (!outcome.ok) return res.status(outcome.code).json({ error: outcome.error });

        res.json({
            success: true,
            status: outcome.status,
            transferId: outcome.transferId,
            transferAmount: outcome.transferAmount,
            platformFee: outcome.platformFee,
        });

    } catch (error: any) {
        console.error('[Escrow Release] Error:', error);
        res.status(500).json({ error: error.message });
    }
};


// Create Dispute
export const createDispute = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const { orderId, reason, description } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Verify Ownership & Eligibility
        const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Only buyer (or seller?) usually buyer.
        if (order.buyer_id !== userId && order.seller_id !== userId) {
            return res.status(403).json({ error: 'Not authorized for this order' });
        }
        // Disputes only make sense while money/goods are in flight.
        if (!['paid', 'escrow_held', 'meetup_arranged', 'shipped', 'delivered'].includes(order.status)) {
            return res.status(400).json({ error: `Order cannot be disputed in status "${order.status}"` });
        }
        if (typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ error: 'reason is required' });
        const { data: existingDispute } = await supabase
            .from('disputes').select('id').eq('order_id', orderId).in('status', ['open', 'resolving']).maybeSingle();
        if (existingDispute) return res.status(409).json({ error: 'An open dispute already exists for this order' });

        // 2. Create Dispute
        const { data: dispute, error: disputeError } = await supabase
            .from('disputes')
            .insert({
                order_id: orderId,
                status: 'open',
                reason,
                description, // Assuming table has description or metadata
                created_by: userId
            })
            .select()
            .single();

        if (disputeError) throw disputeError;

        // 3. Update Order Status — conditional on the status we validated, so a confirm
        //    that finished in between cannot be flipped back to 'disputed'.
        const { data: flagged, error: flagError } = await supabase
            .from('orders')
            .update({ status: 'disputed', updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .eq('status', order.status)
            .select('id');
        if (flagError) throw flagError;
        if (!flagged || flagged.length === 0) {
            await supabase.from('disputes').update({ status: 'dismissed', admin_note: 'Order changed state while the dispute was being opened' }).eq('id', dispute.id);
            return res.status(409).json({ error: 'Order changed state; please reload and try again' });
        }

        await supabase.from('order_timeline').insert({
            order_id: orderId, event_type: 'dispute_opened', description: reason.trim(), created_by: userId, metadata: { dispute_id: dispute.id },
        });

        res.json({ success: true, disputeId: dispute.id });

    } catch (error: any) {
        console.error('Error creating dispute:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get User Orders (Buyer or Seller)
const ORDER_PRODUCT_COLUMNS = 'products(id, title, images, price, currency, status)';
const ORDERS_DEFAULT_LIMIT = 50;
const ORDERS_MAX_LIMIT = 200;

const parseBoundedInt = (raw: unknown, fallback: number, max: number): number => {
    const n = Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(n, max);
};

export const getUserOrders = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const authHeader = req.headers.authorization;
        const { role } = req.query;

        if (!userId || !authHeader) {
            return res.status(401).json({ error: 'Unauthorized: Missing credentials' });
        }

        const limit = parseBoundedInt(req.query.limit, ORDERS_DEFAULT_LIMIT, ORDERS_MAX_LIMIT) || ORDERS_DEFAULT_LIMIT;
        const offset = parseBoundedInt(req.query.offset, 0, Number.MAX_SAFE_INTEGER);

        // Use the caller's own JWT so RLS applies.
        const client = getAuthClient(authHeader);

        let query = client
            .from('orders')
            .select(`*, ${ORDER_PRODUCT_COLUMNS}`);

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

        if (error) {
            console.error('[Orders] Supabase Query Error:', JSON.stringify(error));
            throw error;
        }

        res.json({ orders: orders || [] });

    } catch (error: any) {
        console.error('[Orders] Critical Error:', error);
        res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (!endpointSecret || !sig) {
            // Fail closed: an unsigned payload must never be able to mark orders as paid.
            console.error('Webhook rejected: missing STRIPE_WEBHOOK_SECRET or stripe-signature header');
            return res.status(400).json({ error: 'Webhook signature required' });
        }
        event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        const outcome = await processStripeEvent(event, 'legacy');
        res.json({ received: true, outcome });
    } catch (error: any) {
        console.error('[Webhook] Error processing event:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
};
