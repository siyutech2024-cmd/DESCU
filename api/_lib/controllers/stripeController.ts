import { supabase } from '../db/supabase.js';
import { getStripe } from '../lib/stripe.js';
import { HttpError, asyncHandler, badRequest, forbidden, notFound, parseBody } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { AWAITING_PAYMENT_STATUSES, isAwaitingPayment, toCents } from '../domain/orders.js';
import { transitionOrder } from '../services/orderTransitionService.js';
import { processStripeEvent } from '../services/stripeWebhookService.js';
import { ConfirmPaymentSchema, CreatePaymentIntentSchema } from '../schemas/stripe.js';
import { verifyStripeSignature } from './paymentController.js';

/**
 * Stripe handlers:
 *  - Express Connect (v2) onboarding: create-account / account-status / dashboard-link / webhook
 *  - In-app card payment: create-payment-intent / confirm-payment
 * Stripe API errors are thrown raw; errorMiddleware maps Stripe 4xx to a 400 with Stripe's message.
 */

// ==================================================================
// STRIPE EXPRESS V2 CONNECT ENDPOINTS
// Uses type: 'express' with platform-managed fees/losses collection.
// ==================================================================

/** Create (or resume onboarding for) a Stripe Express connected account and return an onboarding link. */
export const createConnectAccount = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).single();
    if (!user?.email) throw badRequest('User email is required');

    // Check if seller already has a Stripe account
    const { data: existingSeller } = await supabase
        .from('sellers')
        .select('stripe_connect_id, onboarding_complete')
        .eq('user_id', userId)
        .single();

    if (existingSeller?.stripe_connect_id && existingSeller.onboarding_complete) {
        return res.json({
            success: true,
            accountId: existingSeller.stripe_connect_id,
            onboardingComplete: true,
            message: 'Account already set up',
        });
    }

    let stripeAccountId: string;
    if (existingSeller?.stripe_connect_id) {
        // Account exists but onboarding not complete
        stripeAccountId = existingSeller.stripe_connect_id;
    } else {
        const account = await getStripe().accounts.create({
            type: 'express',
            country: 'MX',
            email: user.email,
            business_type: 'individual',
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            settings: { payouts: { schedule: { interval: 'daily' } } },
            metadata: { user_id: userId, platform: 'DESCU', created_via: 'v2_api' },
        });
        stripeAccountId = account.id;
        console.log('[StripeV2] Created Express account:', stripeAccountId);

        await supabase.from('sellers').upsert({
            user_id: userId,
            stripe_connect_id: stripeAccountId,
            stripe_account_status: 'pending',
            onboarding_complete: false,
        }, { onConflict: 'user_id' });
    }

    // Generate Account Link for onboarding
    const baseUrl = process.env.VITE_API_URL || 'https://www.descu.ai';
    const accountLink = await getStripe().accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${baseUrl}/profile?stripe_refresh=true`,
        return_url: `${baseUrl}/profile?stripe_success=true`,
        type: 'account_onboarding',
    });
    console.log('[StripeV2] Created account link for user:', userId);

    res.json({
        success: true,
        accountId: stripeAccountId,
        onboardingUrl: accountLink.url,
        expiresAt: accountLink.expires_at,
    });
});

/** Express account status with capability / requirement details; syncs the local seller row. */
export const getConnectAccountStatus = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;

    const { data: seller } = await supabase
        .from('sellers')
        .select('stripe_connect_id, onboarding_complete, stripe_account_status')
        .eq('user_id', userId)
        .single();

    if (!seller?.stripe_connect_id) {
        return res.json({ hasAccount: false, onboardingComplete: false, payoutsEnabled: false, chargesEnabled: false });
    }

    const account = await getStripe().accounts.retrieve(seller.stripe_connect_id);

    const status = {
        hasAccount: true,
        accountId: seller.stripe_connect_id,
        onboardingComplete: account.details_submitted || false,
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        capabilities: {
            transfers: account.capabilities?.transfers,
            card_payments: account.capabilities?.card_payments,
        },
        requirements: {
            currentlyDue: account.requirements?.currently_due || [],
            eventuallyDue: account.requirements?.eventually_due || [],
            pastDue: account.requirements?.past_due || [],
            pendingVerification: account.requirements?.pending_verification || [],
        },
        email: account.email,
    };

    // Update local status if changed
    const newStatus = account.payouts_enabled ? 'active' :
        account.details_submitted ? 'pending_verification' : 'pending';
    if (account.details_submitted !== seller.onboarding_complete || newStatus !== seller.stripe_account_status) {
        await supabase.from('sellers').update({
            onboarding_complete: account.details_submitted,
            stripe_account_status: newStatus,
        }).eq('user_id', userId);
    }

    res.json(status);
});

/** Stripe Express Dashboard login link for an onboarded seller. */
export const createDashboardLink = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;

    const { data: seller } = await supabase
        .from('sellers')
        .select('stripe_connect_id, onboarding_complete')
        .eq('user_id', userId)
        .single();

    if (!seller?.stripe_connect_id) throw notFound('No Stripe account found');
    if (!seller.onboarding_complete) throw badRequest('Please complete onboarding first');

    const loginLink = await getStripe().accounts.createLoginLink(seller.stripe_connect_id);
    res.json({ success: true, dashboardUrl: loginLink.url });
});

/** V2 webhook (account updates + payment events). Processing errors → 500 via asyncHandler so Stripe retries. */
export const handleStripeV2Webhook = asyncHandler(async (req, res) => {
    const event = verifyStripeSignature(req, res, 'StripeV2 Webhook');
    if (!event) return;
    const outcome = await processStripeEvent(event, 'v2');
    res.json({ received: true, outcome });
});

// ==================================================================
// IN-APP CARD PAYMENT
// ==================================================================

export const createPaymentIntent = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { orderId } = parseBody(CreatePaymentIntentSchema, req.body);
    const userId = req.user!.id;

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) throw notFound('Order not found');
    if (order.buyer_id !== userId) throw forbidden('Unauthorized');
    if (order.payment_method !== 'online') throw badRequest('This order is paid in cash');
    if (order.payment_captured === true || !isAwaitingPayment(order.status)) throw badRequest('Invalid order status');

    const paymentIntent = await getStripe().paymentIntents.create({
        amount: toCents(Number(order.total_amount)),
        currency: 'mxn',
        payment_method_types: ['card'],
        metadata: { order_id: order.id, buyer_id: order.buyer_id, seller_id: order.seller_id },
        description: `Order ${order.id}`,
    });

    await supabase.from('orders').update({ stripe_payment_intent_id: paymentIntent.id }).eq('id', orderId);
    await supabase.from('order_timeline').insert({
        order_id: orderId, event_type: 'payment_intent_created', description: 'Payment Intent Created', created_by: userId,
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
});

export const confirmPayment = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { orderId, paymentIntentId } = parseBody(ConfirmPaymentSchema, req.body);
    const userId = req.user!.id;

    const { data: existing, error: loadError } = await supabase
        .from('orders')
        .select('id, buyer_id, status, total_amount, currency, stripe_payment_intent_id, payment_captured, payment_method')
        .eq('id', orderId)
        .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) throw notFound('Order not found');
    if (existing.buyer_id !== userId) throw forbidden('Unauthorized');
    if (existing.payment_method !== 'online') throw badRequest('This order is paid in cash');
    if (existing.payment_captured === true || !isAwaitingPayment(existing.status)) {
        throw badRequest(`Order is not awaiting payment (status: ${existing.status})`);
    }

    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') throw badRequest('Payment not succeeded');

    // The PaymentIntent must be the one created for THIS order, for the full amount, in the same currency.
    const belongsToOrder =
        existing.stripe_payment_intent_id === paymentIntent.id || paymentIntent.metadata?.order_id === orderId;
    const expectedCents = toCents(Number(existing.total_amount));
    const currencyMatches = paymentIntent.currency.toLowerCase() === (existing.currency || 'mxn').toLowerCase();
    if (!belongsToOrder || paymentIntent.amount_received < expectedCents || !currencyMatches) {
        console.warn('[confirm-payment] PaymentIntent does not match order', { orderId, paymentIntentId });
        throw badRequest('Payment does not match this order');
    }

    const outcome = await transitionOrder({
        orderId,
        from: AWAITING_PAYMENT_STATUSES,
        to: 'paid',
        patch: { payment_captured: true, stripe_payment_intent_id: paymentIntent.id },
        where: q => q.eq('buyer_id', userId).or('payment_captured.is.null,payment_captured.eq.false'),
        timeline: { event_type: 'payment_confirmed', description: 'Payment Confirmed', created_by: userId, metadata: { payment_intent_id: paymentIntentId } },
    });
    if (!outcome.ok) {
        // The webhook usually wins this race; the order is paid either way.
        const { data: current } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
        if (current?.payment_captured) return res.json({ success: true, order: current, alreadyProcessed: true });
        throw new HttpError(outcome.code, outcome.error);
    }

    res.json({ success: true, order: outcome.order });
});
