import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/userAuth.js';
import { getStripe } from '../lib/stripe.js';
import { AWAITING_PAYMENT_STATUSES, isAwaitingPayment, toCents } from '../domain/orders.js';
import { transitionOrder } from '../services/orderTransitionService.js';
import { processStripeEvent } from '../services/stripeWebhookService.js';
import { handleStripeWebhook } from '../controllers/paymentController.js';

/**
 * Stripe routes.
 *  - POST /api/payment/webhook      legacy webhook URL (kept: Stripe may still be configured to it)
 *  - /api/stripe/v2/*               Express Connect onboarding + webhook
 *  - /api/stripe/create-payment-intent, /api/stripe/confirm-payment   in-app card payment
 * Raw-body parsing for both webhooks is configured in app.ts.
 */
export const stripeRouter = Router();
const router = stripeRouter;

// Webhook (no auth — verified by Stripe signature)
router.post('/api/payment/webhook', handleStripeWebhook);

// ==================================================================
// STRIPE EXPRESS V2 CONNECT ENDPOINTS
// Uses V2 API with dashboard: 'express' (NOT type: 'express')
// Platform handles fees and losses collection
// ==================================================================

/**
 * Create a Stripe Express Connected Account using V2 API
 * Uses dashboard: 'express' for Stripe-hosted onboarding
 * Platform is responsible for fees_collector and losses_collector
 */
router.post('/api/stripe/v2/create-account', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).single();

        if (!user?.email) {
            return res.status(400).json({ error: 'User email is required' });
        }

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
                message: 'Account already set up'
            });
        }

        let stripeAccountId: string;

        if (existingSeller?.stripe_connect_id) {
            // Account exists but onboarding not complete
            stripeAccountId = existingSeller.stripe_connect_id;
        } else {
            // Create new Express account using V2 API pattern
            // Note: Using dashboard: 'express' instead of type: 'express'
            const account = await getStripe().accounts.create({
                // V2 pattern: use 'express' type but with our configuration
                type: 'express',
                country: 'MX',
                email: user.email,
                business_type: 'individual',
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'daily',
                        },
                    },
                },
                metadata: {
                    user_id: userId,
                    platform: 'DESCU',
                    created_via: 'v2_api'
                }
            });

            stripeAccountId = account.id;
            console.log('[StripeV2] Created Express account:', stripeAccountId);

            // Save to database
            await supabase.from('sellers').upsert({
                user_id: userId,
                stripe_connect_id: stripeAccountId,
                stripe_account_status: 'pending',
                onboarding_complete: false
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
            expiresAt: accountLink.expires_at
        });

    } catch (error: any) {
        console.error('[StripeV2] Create account error:', error);

        // Return detailed Stripe error info for debugging
        const errorResponse: any = {
            error: 'Failed to create account',
            message: error.message,
        };

        // Add Stripe-specific error details if available
        if (error.type) errorResponse.stripeErrorType = error.type;
        if (error.code) errorResponse.stripeErrorCode = error.code;
        if (error.param) errorResponse.stripeParam = error.param;
        if (error.raw?.message) errorResponse.stripeRawMessage = error.raw.message;

        res.status(500).json(errorResponse);
    }
});

/**
 * Get Express account status with detailed capability info
 */
router.get('/api/stripe/v2/account-status', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete, stripe_account_status')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.json({
                hasAccount: false,
                onboardingComplete: false,
                payoutsEnabled: false,
                chargesEnabled: false
            });
        }

        // Retrieve account with full details
        const account = await getStripe().accounts.retrieve(seller.stripe_connect_id);

        // Check capability status (V2 pattern)
        const transfersStatus = account.capabilities?.transfers;
        const cardPaymentsStatus = account.capabilities?.card_payments;

        const status = {
            hasAccount: true,
            accountId: seller.stripe_connect_id,
            onboardingComplete: account.details_submitted || false,
            payoutsEnabled: account.payouts_enabled || false,
            chargesEnabled: account.charges_enabled || false,
            capabilities: {
                transfers: transfersStatus,
                card_payments: cardPaymentsStatus
            },
            requirements: {
                currentlyDue: account.requirements?.currently_due || [],
                eventuallyDue: account.requirements?.eventually_due || [],
                pastDue: account.requirements?.past_due || [],
                pendingVerification: account.requirements?.pending_verification || []
            },
            email: account.email
        };

        // Update local status if changed
        const newStatus = account.payouts_enabled ? 'active' :
            account.details_submitted ? 'pending_verification' : 'pending';

        if (account.details_submitted !== seller.onboarding_complete ||
            newStatus !== seller.stripe_account_status) {
            await supabase.from('sellers').update({
                onboarding_complete: account.details_submitted,
                stripe_account_status: newStatus
            }).eq('user_id', userId);
        }

        res.json(status);

    } catch (error: any) {
        console.error('[StripeV2] Get account status error:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

/**
 * Get Stripe Express Dashboard login link for sellers
 */
router.get('/api/stripe/v2/dashboard-link', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.status(404).json({ error: 'No Stripe account found' });
        }

        if (!seller.onboarding_complete) {
            return res.status(400).json({ error: 'Please complete onboarding first' });
        }

        const loginLink = await getStripe().accounts.createLoginLink(seller.stripe_connect_id);

        res.json({
            success: true,
            dashboardUrl: loginLink.url
        });

    } catch (error: any) {
        console.error('[StripeV2] Create dashboard link error:', error);
        res.status(500).json({ error: 'Failed to create dashboard link', message: error.message });
    }
});

/**
 * Handle Stripe Webhook events (Thin Events for V2)
 * This handles account updates and payment events
 */
router.post('/api/stripe/v2/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[StripeV2 Webhook] No webhook secret configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
        event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        console.error('[StripeV2 Webhook] Signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    try {
        const outcome = await processStripeEvent(event, 'v2');
        res.json({ received: true, outcome });
    } catch (error: any) {
        console.error('[StripeV2 Webhook] Error processing event:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

router.post('/api/stripe/create-payment-intent', requireAuth, async (req: any, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.id;

        const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (order.payment_method !== 'online') return res.status(400).json({ error: 'This order is paid in cash' });
        if (order.payment_captured === true || !isAwaitingPayment(order.status)) {
            return res.status(400).json({ error: 'Invalid order status' });
        }

        const paymentIntent = await getStripe().paymentIntents.create({
            amount: toCents(Number(order.total_amount)),
            currency: 'mxn',
            payment_method_types: ['card'],
            metadata: { order_id: order.id, buyer_id: order.buyer_id, seller_id: order.seller_id },
            description: `Order ${order.id}`,
        });

        await supabase.from('orders').update({ stripe_payment_intent_id: paymentIntent.id }).eq('id', orderId);
        await supabase.from('order_timeline').insert({
            order_id: orderId, event_type: 'payment_intent_created', description: 'Payment Intent Created', created_by: userId
        });

        res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (error: any) {
        console.error('Create PI error:', error);
        res.status(500).json({ error: 'Failed to create payment intent', message: error.message });
    }
});

router.post('/api/stripe/confirm-payment', requireAuth, async (req: any, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;
        const userId = req.user.id;

        if (typeof orderId !== 'string' || typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
            return res.status(400).json({ error: 'orderId and paymentIntentId are required' });
        }

        const { data: existing, error: loadError } = await supabase
            .from('orders')
            .select('id, buyer_id, status, total_amount, currency, stripe_payment_intent_id, payment_captured, payment_method')
            .eq('id', orderId)
            .maybeSingle();
        if (loadError) throw loadError;
        if (!existing) return res.status(404).json({ error: 'Order not found' });
        if (existing.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (existing.payment_method !== 'online') return res.status(400).json({ error: 'This order is paid in cash' });
        if (existing.payment_captured === true || !isAwaitingPayment(existing.status)) {
            return res.status(400).json({ error: `Order is not awaiting payment (status: ${existing.status})` });
        }

        const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') return res.status(400).json({ error: 'Payment not succeeded' });

        // The PaymentIntent must be the one created for THIS order, for the full amount, in the same currency.
        const belongsToOrder =
            existing.stripe_payment_intent_id === paymentIntent.id || paymentIntent.metadata?.order_id === orderId;
        const expectedCents = toCents(Number(existing.total_amount));
        const currencyMatches = paymentIntent.currency.toLowerCase() === (existing.currency || 'mxn').toLowerCase();
        if (!belongsToOrder || paymentIntent.amount_received < expectedCents || !currencyMatches) {
            console.warn('[confirm-payment] PaymentIntent does not match order', { orderId, paymentIntentId });
            return res.status(400).json({ error: 'Payment does not match this order' });
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
            return res.status(outcome.code).json({ error: outcome.error });
        }

        res.json({ success: true, order: outcome.order });
    } catch (error: any) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: 'Failed to confirm payment', message: error.message });
    }
});
