import { supabase } from '../db/supabase.js';
import { getStripe } from '../lib/stripe.js';
import {
    AWAITING_PAYMENT_STATUSES,
    ORDER_EXPIRY_GRACE_MS,
    canTransition,
    cancelBlockReason,
    isOrderStatus,
    type OrderStatus,
} from '../domain/orderStatus.js';

/**
 * The only code that writes `orders.status`.
 *
 * `transitionOrder` performs one conditional UPDATE:
 *     UPDATE orders SET status = <to>, …patch WHERE id = ? AND status IN (<from>) [AND …where]
 * so two racing callers (double click, webhook + user, two admins) can never both win,
 * and an illegal edge in the state graph is rejected before touching the database.
 */

type Builder = any; // PostgREST filter builder — typed loosely so callers can add .or()/.eq() filters

export interface TimelineEntry {
    event_type: string;
    description: string;
    created_by?: string | null;
    metadata?: Record<string, unknown>;
}

export interface TransitionInput {
    orderId: string;
    /** Status(es) the row must currently be in. */
    from: OrderStatus | readonly OrderStatus[];
    to: OrderStatus;
    /** Extra columns to set in the same UPDATE. `status`/`updated_at` are owned by the service. */
    patch?: Record<string, unknown>;
    /** Additional conditions on the UPDATE (e.g. a lock column or "not yet captured"). */
    where?: (q: Builder) => Builder;
    /** Written after a successful transition. */
    timeline?: TimelineEntry;
    /** Columns to return; defaults to the whole row. */
    select?: string;
}

export type TransitionResult =
    | { ok: true; order: Record<string, any> }
    | { ok: false; code: 400 | 409; error: string };

export const transitionOrder = async (input: TransitionInput): Promise<TransitionResult> => {
    const froms = (Array.isArray(input.from) ? input.from : [input.from]) as OrderStatus[];
    const illegal = froms.filter(f => !canTransition(f, input.to));
    if (froms.length === 0 || illegal.length > 0) {
        return { ok: false, code: 400, error: `Order cannot go from "${(illegal.length ? illegal : froms).join('/')}" to "${input.to}"` };
    }

    const now = new Date().toISOString();
    let query: Builder = supabase
        .from('orders')
        .update({ ...(input.patch ?? {}), status: input.to, updated_at: now })
        .eq('id', input.orderId)
        .in('status', froms);
    if (input.where) query = input.where(query);

    const { data, error } = await query.select(input.select ?? '*');
    if (error) throw error;
    if (!data || data.length === 0) {
        return { ok: false, code: 409, error: 'Order changed state; please reload and try again' };
    }

    if (input.timeline) {
        await supabase.from('order_timeline').insert({
            order_id: input.orderId,
            event_type: input.timeline.event_type,
            description: input.timeline.description,
            created_by: input.timeline.created_by ?? null,
            metadata: input.timeline.metadata ?? {},
        });
    }
    return { ok: true, order: data[0] };
};

export interface CancelInput {
    order: {
        id: string;
        status: string;
        buyer_id: string;
        seller_id: string;
        product_id?: string | null;
        payment_method?: string | null;
        payment_captured?: boolean | null;
        stripe_payment_intent_id?: string | null;
    };
    actorId: string;
    reason?: string | null;
}

export type CancelResult = TransitionResult | { ok: false; code: 403 | 400; error: string };

/** Buyer/seller cancel. Rules in domain/orderStatus.ts (`cancelBlockReason`). */
export const cancelOrder = async ({ order, actorId, reason }: CancelInput): Promise<CancelResult> => {
    const blocked = cancelBlockReason(order, actorId);
    if (blocked) {
        return { ok: false, code: blocked.startsWith('Not authorized') ? 403 : 400, error: blocked };
    }
    const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null;
    const isBuyer = order.buyer_id === actorId;
    const outcome = await transitionOrder({
        orderId: order.id,
        from: order.status as OrderStatus,
        to: 'cancelled',
        // Who/why lives in the timeline: the orders table has no cancellation columns.
        // Never cancel underneath a payment that just landed.
        where: q => q.or('payment_captured.is.null,payment_captured.eq.false'),
        timeline: {
            event_type: 'cancelled',
            description: `${isBuyer ? 'Buyer' : 'Seller'} cancelled the order${cleanReason ? `: ${cleanReason}` : ''}`,
            created_by: actorId,
            metadata: { reason: cleanReason, by: isBuyer ? 'buyer' : 'seller' },
        },
    });
    if (outcome.ok) {
        await reopenProductAfterCancel(order.product_id, outcome.order?.product_id);
        await cancelPaymentIntent(order.stripe_payment_intent_id ?? outcome.order?.stripe_payment_intent_id);
    }
    return outcome;
};

/**
 * Best effort: void the PaymentIntent of a cancelled order so a late 3DS completion / OXXO
 * voucher cannot capture money for it. Stripe refuses to cancel `processing`/`succeeded`
 * intents — those land in the webhook's payment_orphaned path for support.
 */
const cancelPaymentIntent = async (paymentIntentId: string | null | undefined) => {
    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) return;
    try {
        await getStripe().paymentIntents.cancel(paymentIntentId, { cancellation_reason: 'abandoned' });
    } catch (err: any) {
        console.warn('[cancelOrder] could not cancel PaymentIntent', paymentIntentId, err?.message ?? err);
    }
};

/** A cancelled cash order never marked its product sold; a cancelled online order may have (legacy). Put it back on sale. */
const reopenProductAfterCancel = async (...candidates: (string | null | undefined)[]) => {
    const productId = candidates.find(Boolean);
    if (!productId) return;
    await supabase.from('products').update({ status: 'active' }).eq('id', productId).eq('status', 'sold');
};

export interface ExpireResult {
    scanned: number;
    cancelled: number;
    orderIds: string[];
}

/**
 * Cancel online orders that were never paid: status pending_payment, past
 * `expires_at` by the grace period, no captured payment. Run from the cron route.
 */
export const expireUnpaidOrders = async (limit = 100): Promise<ExpireResult> => {
    const cutoff = new Date(Date.now() - ORDER_EXPIRY_GRACE_MS).toISOString();
    const { data: stale, error } = await supabase
        .from('orders')
        .select('id, status, product_id, payment_method, payment_captured, expires_at, stripe_payment_intent_id')
        .eq('status', 'pending_payment')
        .eq('payment_method', 'online')
        .or('payment_captured.is.null,payment_captured.eq.false')
        .lt('expires_at', cutoff)
        .order('expires_at', { ascending: true })
        .limit(limit);
    if (error) throw error;

    const orderIds: string[] = [];
    for (const order of stale ?? []) {
        if (!isOrderStatus(order.status)) continue;
        const outcome = await transitionOrder({
            orderId: order.id,
            from: 'pending_payment',
            to: 'cancelled',
            where: q => q.or('payment_captured.is.null,payment_captured.eq.false'),
            timeline: {
                event_type: 'cancelled',
                description: 'Order expired: payment was not received in time',
                metadata: { reason: 'payment_expired', expires_at: order.expires_at },
            },
            select: 'id, product_id',
        });
        if (outcome.ok) {
            orderIds.push(order.id);
            await reopenProductAfterCancel(order.product_id);
            await cancelPaymentIntent(order.stripe_payment_intent_id);
        }
    }
    return { scanned: stale?.length ?? 0, cancelled: orderIds.length, orderIds };
};

/**
 * One item, one buyer. Once an order for a product is paid online or completed, every other
 * open order on that product that holds no captured money (unpaid online orders, cash intents)
 * is cancelled and its buyer told in the chat. Returns the cancelled order ids.
 */
export const closeCompetingOrders = async (productId: string, winnerOrderId: string, reason: 'sold' | 'paid' = 'sold'): Promise<string[]> => {
    const { data: rivals, error } = await supabase
        .from('orders')
        .select('id, status, payment_method, payment_captured, stripe_payment_intent_id')
        .eq('product_id', productId)
        .neq('id', winnerOrderId)
        .in('status', ['pending_payment', 'paid', 'meetup_arranged']);
    if (error) throw error;

    const cancelled: string[] = [];
    for (const rival of rivals ?? []) {
        if (!isOrderStatus(rival.status) || !canTransition(rival.status, 'cancelled')) continue;
        // Never touch money: only unpaid online orders and cash intents are closed. (Legacy paid
        // online rows carry payment_captured = null and must be left alone.)
        const holdsNoMoney = rival.status === 'pending_payment' ? !rival.payment_captured : rival.payment_method === 'cash';
        if (!holdsNoMoney) continue;
        const outcome = await transitionOrder({
            orderId: rival.id,
            from: rival.status,
            to: 'cancelled',
            where: q => q.or('payment_captured.is.null,payment_captured.eq.false'),
            timeline: {
                event_type: 'cancelled',
                description: reason === 'paid' ? 'Cancelled: another buyer paid for this item' : 'Cancelled: the item was sold to another buyer',
                metadata: { reason: 'product_sold_elsewhere', winner_order_id: winnerOrderId },
            },
            select: 'id, stripe_payment_intent_id',
        });
        if (!outcome.ok) continue;
        cancelled.push(rival.id);
        await cancelPaymentIntent(rival.stripe_payment_intent_id);
        import('./orderNotificationService.js')
            .then(({ notifyOrderStatus }) => notifyOrderStatus(rival.id, 'cancelled').catch(console.error))
            .catch(console.error);
    }
    return cancelled;
};

/** Shared by the webhook and confirm-payment: an order may be paid only while it is waiting for money. */
export const AWAITING_PAYMENT = AWAITING_PAYMENT_STATUSES;
