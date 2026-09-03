import type Stripe from 'stripe';
import { supabase } from '../db/supabase.js';
import { toCents } from '../domain/orders.js';

/**
 * Single implementation behind both Stripe webhook endpoints
 * (/api/payment/webhook and /api/stripe/v2/webhook).
 *
 * Guarantees:
 *  - idempotent per Stripe event id (stripe_events table; a retry is a no-op)
 *  - an order only moves to escrow_held/paid from an *awaiting payment* state,
 *    so a late or replayed event can never regress a completed order
 *  - money is only marked as captured when Stripe says the session/intent is paid
 *    and the amount covers the order total (OXXO/SPEI complete asynchronously)
 */

const AWAITING_PAYMENT = ['pending_payment', 'meetup_arranged'];

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored';

/** Returns false when this event id was already processed. */
const claimEvent = async (event: Stripe.Event): Promise<boolean> => {
    const { error } = await supabase
        .from('stripe_events')
        .insert({ event_id: event.id, event_type: event.type, created_at: new Date(event.created * 1000).toISOString() });
    if (!error) return true;
    if (error.code === '23505') return false; // unique_violation → already processed
    // Table missing or other DB failure: log loudly but do not drop the event.
    console.error('[Stripe webhook] stripe_events insert failed; processing without dedupe:', error.message);
    return true;
};

const markOrderPaid = async (params: {
    orderId: string;
    paymentIntentId: string | null;
    amountReceivedCents: number | null;
    isEscrow: boolean;
    platformFeeCents: number | null;
    source: string;
}) => {
    const { orderId, paymentIntentId, amountReceivedCents, isEscrow, platformFeeCents, source } = params;

    const { data: order, error } = await supabase
        .from('orders')
        .select('id, status, total_amount, payment_captured, product_id')
        .eq('id', orderId)
        .maybeSingle();
    if (error) throw error;
    if (!order) {
        console.warn(`[Stripe webhook] ${source}: order ${orderId} not found`);
        return;
    }
    if (order.payment_captured || !AWAITING_PAYMENT.includes(order.status)) {
        console.log(`[Stripe webhook] ${source}: order ${orderId} already ${order.status}; skipping`);
        if (!order.payment_captured && amountReceivedCents) {
            // Money was captured for an order that is no longer waiting for it (cancelled /
            // edited meanwhile): leave a trail so support can refund it.
            await supabase.from('order_timeline').insert({
                order_id: orderId,
                event_type: 'payment_orphaned',
                description: `Stripe captured ${amountReceivedCents} cents but the order is in status "${order.status}"`,
                metadata: { payment_intent: paymentIntentId, source },
            });
        }
        return;
    }
    if (amountReceivedCents !== null && amountReceivedCents < toCents(Number(order.total_amount))) {
        console.error(`[Stripe webhook] ${source}: amount ${amountReceivedCents} < order total for ${orderId}`);
        await supabase.from('order_timeline').insert({
            order_id: orderId,
            event_type: 'payment_amount_mismatch',
            description: `Stripe reported ${amountReceivedCents} cents, order total is ${toCents(Number(order.total_amount))}`,
            metadata: { payment_intent: paymentIntentId, source },
        });
        return;
    }

    const patch: Record<string, unknown> = {
        status: isEscrow ? 'escrow_held' : 'paid',
        payment_captured: true,
        escrow_status: isEscrow ? 'held' : 'none',
        updated_at: new Date().toISOString(),
    };
    if (paymentIntentId) patch.stripe_payment_intent_id = paymentIntentId;
    if (platformFeeCents !== null) patch.platform_fee = platformFeeCents / 100;

    // Conditional update: only the row that is still awaiting payment is touched.
    const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', orderId)
        .in('status', AWAITING_PAYMENT)
        .or('payment_captured.is.null,payment_captured.eq.false')
        .select('id');
    if (updateError) throw updateError;
    if (!updated || updated.length === 0) return; // lost the race to a concurrent event — fine

    await supabase.from('order_timeline').insert({
        order_id: orderId,
        event_type: isEscrow ? 'escrow_payment_received' : 'payment_completed',
        description: isEscrow ? '付款成功，资金已进入担保账户，等待买家确认收货后释放' : 'Payment completed via Stripe',
        metadata: { payment_intent: paymentIntentId, escrow: isEscrow, source },
    });

    // Mark the product as sold so it leaves the feed.
    if (order.product_id) {
        await supabase.from('products').update({ status: 'sold' }).eq('id', order.product_id).eq('status', 'active');
    }

    import('./orderNotificationService.js')
        .then(({ notifyOrderStatus }) => notifyOrderStatus(orderId, isEscrow ? 'escrow_held' : 'paid', { message: '买家已付款' }).catch(console.error))
        .catch(console.error);
};

const handleCheckoutSession = async (session: Stripe.Checkout.Session, source: string) => {
    const orderId = session.metadata?.order_id;
    if (!orderId) return;
    // For delayed methods (OXXO/SPEI) `completed` fires with payment_status 'unpaid';
    // the money arrives with checkout.session.async_payment_succeeded.
    if (session.payment_status !== 'paid') {
        console.log(`[Stripe webhook] ${source}: session ${session.id} not paid yet (${session.payment_status})`);
        return;
    }
    const platformFee = session.metadata?.platform_fee ? Number(session.metadata.platform_fee) : null;
    await markOrderPaid({
        orderId,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
        amountReceivedCents: session.amount_total ?? null,
        isEscrow: session.metadata?.escrow === 'true',
        platformFeeCents: Number.isFinite(platformFee) ? platformFee : null,
        source,
    });
};

const handleAsyncPaymentFailed = async (session: Stripe.Checkout.Session) => {
    const orderId = session.metadata?.order_id;
    if (!orderId) return;
    await supabase.from('order_timeline').insert({
        order_id: orderId,
        event_type: 'payment_failed',
        description: 'Async payment (OXXO/SPEI) failed or expired',
        metadata: { session_id: session.id },
    });
    await supabase.from('orders').update({ escrow_status: 'payment_failed', updated_at: new Date().toISOString() })
        .eq('id', orderId).in('status', AWAITING_PAYMENT);
};

const handlePaymentIntentSucceeded = async (pi: Stripe.PaymentIntent, source: string) => {
    // PaymentElement flow: the PI carries order_id (see /api/stripe/create-payment-intent).
    const orderId = pi.metadata?.order_id;
    if (!orderId) return;
    await markOrderPaid({
        orderId,
        paymentIntentId: pi.id,
        amountReceivedCents: pi.amount_received,
        isEscrow: pi.metadata?.escrow === 'true',
        platformFeeCents: null,
        source,
    });
};

const handleAccountUpdated = async (account: Stripe.Account) => {
    await supabase
        .from('sellers')
        .update({
            onboarding_complete: !!account.details_submitted,
            stripe_account_status: account.payouts_enabled ? 'active' : account.details_submitted ? 'pending_verification' : 'pending',
        })
        .eq('stripe_connect_id', account.id);
};

/** Undo a claim so Stripe's retry of a failed delivery is processed instead of skipped. */
const unclaimEvent = async (event: Stripe.Event) => {
    const { error } = await supabase.from('stripe_events').delete().eq('event_id', event.id);
    if (error && error.code !== '42P01') console.error('[Stripe webhook] could not unclaim event', event.id, error.message);
};

export const processStripeEvent = async (event: Stripe.Event, source: string): Promise<WebhookOutcome> => {
    if (!(await claimEvent(event))) return 'duplicate';
    try {
        return await dispatchEvent(event, source);
    } catch (error) {
        // The handler failed after the claim: release the claim, then let the endpoint
        // return 500 so Stripe retries and the retry is actually processed.
        await unclaimEvent(event);
        throw error;
    }
};

const dispatchEvent = async (event: Stripe.Event, source: string): Promise<WebhookOutcome> => {
    switch (event.type) {
        case 'account.updated':
            await handleAccountUpdated(event.data.object as Stripe.Account);
            return 'processed';
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
            await handleCheckoutSession(event.data.object as Stripe.Checkout.Session, source);
            return 'processed';
        case 'checkout.session.async_payment_failed':
            await handleAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
            return 'processed';
        case 'payment_intent.succeeded':
            await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, source);
            return 'processed';
        default:
            return 'ignored';
    }
};
