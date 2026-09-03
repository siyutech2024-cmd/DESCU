import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/userAuth.js';
import { getStripe } from '../lib/stripe.js';
import { toCents } from '../domain/orders.js';
import {
    createPaymentIntent,
    handleStripeWebhook,
    createConnectAccount,
    getLoginLink,
    verifyPayment,
    updateSellerBankInfo
} from '../controllers/paymentController.js';

/**
 * Stripe routes: legacy /api/payment/* (controller based) and the newer
 * /api/stripe/* Express Connect + escrow checkout endpoints.
 */
export const stripeRouter = Router();
const router = stripeRouter;

// ---- Legacy payment endpoints (controller based) ----
// Webhook (no auth — verified by Stripe signature; raw body is configured in app.ts)
router.post('/api/payment/webhook', handleStripeWebhook);
router.post('/api/payment/create-intent', requireAuth, createPaymentIntent);
router.post('/api/payment/connect', requireAuth, createConnectAccount);
router.post('/api/payment/bank-info', requireAuth, updateSellerBankInfo);
router.get('/api/payment/dashboard/:userId', requireAuth, getLoginLink);
router.post('/api/payment/verify', requireAuth, verifyPayment);

router.post('/api/stripe/add-bank-account', requireAuth, async (req: any, res) => {
    try {
        const { accountHolderName, accountNumber, routingNumber, accountHolderType = 'individual' } = req.body;
        const userId = req.user.id; // requireAuth populates this

        const { data: existingAccount } = await supabase.from('stripe_accounts').select().eq('user_id', userId).single();
        let stripeAccountId: string;

        if (existingAccount?.stripe_account_id) {
            stripeAccountId = existingAccount.stripe_account_id;
        } else {
            const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).single();
            const account = await getStripe().accounts.create({
                type: 'custom',
                country: 'MX',
                email: user?.email,
                capabilities: { transfers: { requested: true } },
                business_type: 'individual',
                individual: {
                    email: user?.email,
                    first_name: accountHolderName.split(' ')[0],
                    last_name: accountHolderName.split(' ').slice(1).join(' ') || 'N/A',
                },
            });
            stripeAccountId = account.id;
        }

        const bankAccount = await getStripe().accounts.createExternalAccount(stripeAccountId, {
            external_account: {
                object: 'bank_account',
                account_number: accountNumber,
                routing_number: routingNumber,
                account_holder_name: accountHolderName,
                account_holder_type: accountHolderType,
                currency: 'mxn',
                country: 'MX',
            },
        });

        const { data: savedAccount, error } = await supabase.from('stripe_accounts').upsert({
            user_id: userId,
            stripe_account_id: stripeAccountId,
            bank_account_last4: (bankAccount as any).last4,
            bank_name: (bankAccount as any).bank_name || 'Unknown',
            account_verified: false,
        }).select().single();

        if (error) throw error;
        res.json({ success: true, account: { last4: savedAccount.bank_account_last4, bankName: savedAccount.bank_name } });
    } catch (error: any) {
        console.error('Add bank account error:', error);
        res.status(500).json({ error: 'Failed to add bank account', message: error.message });
    }
});

router.get('/api/stripe/account-status', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data: account } = await supabase.from('stripe_accounts').select().eq('user_id', userId).single();

        if (!account) return res.json({ hasAccount: false, verified: false });

        const stripeAccount = await getStripe().accounts.retrieve(account.stripe_account_id);
        const isVerified = stripeAccount.capabilities?.transfers === 'active';

        if (isVerified !== account.account_verified) {
            await supabase.from('stripe_accounts').update({ account_verified: isVerified }).eq('user_id', userId);
        }

        res.json({
            hasAccount: true,
            verified: isVerified,
            last4: account.bank_account_last4,
            bankName: account.bank_name,
            accountId: account.stripe_account_id,
        });
    } catch (error: any) {
        console.error('Get account status error:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

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
 * Refresh Account Link if expired or for continued onboarding
 */
router.post('/api/stripe/v2/account-link', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.status(404).json({ error: 'No Stripe account found. Please create one first.' });
        }

        const baseUrl = process.env.VITE_API_URL || 'https://www.descu.ai';
        const accountLink = await getStripe().accountLinks.create({
            account: seller.stripe_connect_id,
            refresh_url: `${baseUrl}/profile?stripe_refresh=true`,
            return_url: `${baseUrl}/profile?stripe_success=true`,
            type: 'account_onboarding',
        });

        res.json({
            success: true,
            onboardingUrl: accountLink.url,
            expiresAt: accountLink.expires_at
        });

    } catch (error: any) {
        console.error('[StripeV2] Refresh account link error:', error);
        res.status(500).json({ error: 'Failed to refresh link', message: error.message });
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
 * Create Checkout Session with Escrow Pattern (Separate Charges and Transfers)
 * Funds stay in platform account until buyer confirms receipt
 * Then platform transfers to seller (minus platform fee)
 */
router.post('/api/stripe/v2/checkout-session', requireAuth, async (req: any, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.id;

        if (typeof orderId !== 'string' || !orderId) {
            return res.status(400).json({ error: 'orderId is required' });
        }

        // Get order details
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, products(*)')
            .eq('id', orderId)
            .maybeSingle();
        if (orderError) throw orderError;

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Only the buyer may pay, and only while the order is awaiting payment.
        if (order.buyer_id !== userId) {
            return res.status(403).json({ error: 'Only the buyer can pay for this order' });
        }
        if (order.status !== 'pending_payment') {
            return res.status(400).json({ error: `Order is not awaiting payment (status: ${order.status})` });
        }
        if (order.payment_method !== 'online') {
            return res.status(400).json({ error: 'This order is not paid online' });
        }

        // Get seller info - Stripe Connect is optional, bank info (CLABE) is also valid
        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete, bank_clabe, bank_name, bank_holder_name')
            .eq('user_id', order.seller_id)
            .single();

        // 卖家必须至少完成一种收款方式：Stripe Connect 或 银行卡(CLABE)
        const hasStripeConnect = seller?.stripe_connect_id && seller?.onboarding_complete;
        const hasBankInfo = seller?.bank_clabe && seller?.bank_name && seller?.bank_holder_name;

        if (!hasStripeConnect && !hasBankInfo) {
            return res.status(400).json({
                error: 'Seller has not completed payment setup. Please provide bank info (CLABE) or Stripe account.',
                code: 'SELLER_NOT_READY'
            });
        }

        // Charge exactly what the order says the buyer owes: product + shipping + platform fee.
        // (Previously only products.price was charged, so the platform fee was never collected
        //  and the shipping fee was paid out of the platform's own pocket.)
        const amountInCents = toCents(Number(order.total_amount));
        if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
            return res.status(400).json({ error: 'Order total is invalid' });
        }
        const platformFeeAmount = toCents(Number(order.platform_fee) || 0);

        const baseUrl = process.env.VITE_API_URL || 'https://www.descu.ai';

        // Create Checkout Session - Escrow Pattern (Separate Charges and Transfers)
        // Funds stay in platform account, NOT immediately transferred to seller
        // 卖家可能有Stripe Connect或只有银行卡(CLABE)，两种情况都支持
        const sellerStripeId = seller?.stripe_connect_id || '';
        const sellerPayoutMethod = hasStripeConnect ? 'stripe_connect' : 'manual_spei';

        const session = await getStripe().checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'mxn',
                        product_data: {
                            name: order.products?.title || 'Product',
                            description: order.products?.description?.substring(0, 200) || undefined,
                            images: order.products?.images?.[0] ? [order.products.images[0]] : undefined,
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            payment_intent_data: {
                // NO transfer_data - funds stay in platform account (escrow)
                // NO application_fee_amount - we'll deduct fee when transferring
                capture_method: 'automatic',
                metadata: {
                    order_id: orderId,
                    buyer_id: userId,
                    seller_id: order.seller_id,
                    seller_stripe_id: sellerStripeId,
                    seller_payout_method: sellerPayoutMethod,
                    product_id: order.product_id,
                    platform_fee: platformFeeAmount,
                    escrow: 'true'  // Mark as escrow transaction
                }
            },
            mode: 'payment',
            success_url: `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
            cancel_url: `${baseUrl}/order/cancel?order_id=${orderId}`,
            metadata: {
                order_id: orderId,
                seller_stripe_id: sellerStripeId,
                seller_payout_method: sellerPayoutMethod,
                platform_fee: platformFeeAmount.toString(),
                platform: 'DESCU',
                escrow: 'true'
            }
        });

        // Update order with checkout session and escrow info
        const { error: updateError } = await supabase.from('orders').update({
            stripe_checkout_session_id: session.id,
            escrow_status: 'pending'
        }).eq('id', orderId).eq('status', 'pending_payment');
        if (updateError) throw updateError;

        console.log('[StripeV2 Escrow] Created checkout session:', session.id, 'for order:', orderId, '(escrow mode)');

        res.json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url
        });

    } catch (error: any) {
        console.error('[StripeV2 Escrow] Create checkout session error:', error);
        res.status(500).json({ error: 'Failed to create checkout', message: error.message });
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

    console.log('[StripeV2 Webhook] Received event:', event.type);

    try {
        switch (event.type) {
            // Account events
            case 'account.updated': {
                const account = event.data.object as any;
                console.log('[StripeV2 Webhook] Account updated:', account.id);

                // Update seller status in database
                await supabase.from('sellers')
                    .update({
                        onboarding_complete: account.details_submitted,
                        stripe_account_status: account.payouts_enabled ? 'active' : 'pending'
                    })
                    .eq('stripe_connect_id', account.id);
                break;
            }

            // Payment events - Escrow Pattern
            case 'checkout.session.completed': {
                const session = event.data.object as any;
                console.log('[StripeV2 Webhook] Checkout completed (escrow):', session.id);

                const orderId = session.metadata?.order_id;
                const isEscrow = session.metadata?.escrow === 'true';
                const platformFee = session.metadata?.platform_fee;
                const sellerStripeId = session.metadata?.seller_stripe_id;

                if (orderId) {
                    // Update order to escrow_held status - funds are in platform account
                    await supabase.from('orders').update({
                        status: isEscrow ? 'escrow_held' : 'paid',
                        payment_captured: true,
                        stripe_payment_intent_id: session.payment_intent,
                        escrow_status: isEscrow ? 'held' : 'none',
                        platform_fee: platformFee ? parseFloat(platformFee) / 100 : null
                    }).eq('id', orderId);

                    await supabase.from('order_timeline').insert({
                        order_id: orderId,
                        event_type: isEscrow ? 'escrow_payment_received' : 'payment_completed',
                        description: isEscrow
                            ? '付款成功，资金已进入担保账户，等待买家确认收货后释放'
                            : 'Payment completed via Stripe Checkout',
                        metadata: {
                            session_id: session.id,
                            payment_intent: session.payment_intent,
                            escrow: isEscrow,
                            seller_stripe_id: sellerStripeId
                        }
                    });

                    // 🔔 发送担保支付通知
                    if (isEscrow) {
                        import('../services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
                            notifyOrderStatus(orderId, 'escrow_held', {
                                message: '买家已付款，资金在担保中'
                            }).catch(console.error);
                        }).catch(console.error);
                    }
                }
                break;
            }


            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as any;
                console.log('[StripeV2 Webhook] Payment succeeded:', paymentIntent.id);
                break;
            }

            case 'transfer.created': {
                const transfer = event.data.object as any;
                console.log('[StripeV2 Webhook] Transfer created:', transfer.id,
                    'to', transfer.destination, 'amount:', transfer.amount);
                break;
            }

            default:
                console.log('[StripeV2 Webhook] Unhandled event type:', event.type);
        }

        res.json({ received: true });
    } catch (error: any) {
        console.error('[StripeV2 Webhook] Error processing event:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// ==================================================================
// SELLER BALANCE & PAYOUT ENDPOINTS (Escrow System)
// ==================================================================

/**
 * GET /api/stripe/seller-balance
 * Query seller's Stripe Connected Account balance
 */
router.get('/api/stripe/seller-balance', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        // Get seller's Stripe account
        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.json({
                available: 0,
                pending: 0,
                hasAccount: false,
                message: 'No Stripe account linked'
            });
        }

        if (!seller.onboarding_complete) {
            return res.json({
                available: 0,
                pending: 0,
                hasAccount: true,
                onboardingComplete: false,
                message: 'Please complete Stripe onboarding first'
            });
        }

        // Retrieve balance from seller's connected account
        const balance = await getStripe().balance.retrieve({
            stripeAccount: seller.stripe_connect_id
        });

        // Find MXN balance (primary currency)
        const availableMXN = balance.available.find(b => b.currency === 'mxn')?.amount || 0;
        const pendingMXN = balance.pending.find(b => b.currency === 'mxn')?.amount || 0;

        // Also check for USD or other currencies
        const availableUSD = balance.available.find(b => b.currency === 'usd')?.amount || 0;
        const pendingUSD = balance.pending.find(b => b.currency === 'usd')?.amount || 0;

        res.json({
            available: availableMXN / 100,
            pending: pendingMXN / 100,
            availableUSD: availableUSD / 100,
            pendingUSD: pendingUSD / 100,
            hasAccount: true,
            onboardingComplete: true,
            currency: 'MXN',
            accountId: seller.stripe_connect_id
        });

    } catch (error: any) {
        console.error('[Seller Balance] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve balance', message: error.message });
    }
});

/**
 * POST /api/stripe/seller-payout
 * Seller initiates withdrawal from Stripe balance to bank account
 */
router.post('/api/stripe/seller-payout', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { amount, currency = 'mxn' } = req.body; // amount in decimal (e.g., 100.50)

        // 1. Get seller's Stripe account
        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.status(400).json({ error: 'No Stripe account linked' });
        }

        if (!seller.onboarding_complete) {
            return res.status(400).json({ error: 'Please complete Stripe onboarding first' });
        }

        // 2. Check available balance
        const balance = await getStripe().balance.retrieve({
            stripeAccount: seller.stripe_connect_id
        });

        const availableBalance = balance.available.find(b => b.currency === currency.toLowerCase());

        if (!availableBalance || availableBalance.amount <= 0) {
            return res.status(400).json({
                error: 'No available balance to withdraw',
                available: 0,
                currency: currency.toUpperCase()
            });
        }

        // 3. Calculate payout amount
        const payoutAmountCents = amount
            ? Math.min(Math.round(amount * 100), availableBalance.amount)
            : availableBalance.amount;

        if (payoutAmountCents <= 0) {
            return res.status(400).json({ error: 'Invalid payout amount' });
        }

        // 4. Create Payout (transfer from Stripe balance to bank account)
        const payout = await getStripe().payouts.create({
            amount: payoutAmountCents,
            currency: currency.toLowerCase(),
            metadata: {
                user_id: userId,
                initiated_by: 'seller_request'
            }
        }, {
            stripeAccount: seller.stripe_connect_id
        });

        console.log(`[Seller Payout] Created payout ${payout.id} for user ${userId}, amount: ${payoutAmountCents}`);

        // 5. Record in database for tracking
        await supabase.from('order_timeline').insert({
            event_type: 'seller_payout_initiated',
            description: `卖家发起提现 $${(payoutAmountCents / 100).toFixed(2)} ${currency.toUpperCase()}`,
            created_by: userId,
            metadata: {
                payout_id: payout.id,
                amount: payoutAmountCents / 100,
                currency: currency.toUpperCase(),
                arrival_date: payout.arrival_date
            }
        });

        res.json({
            success: true,
            payoutId: payout.id,
            amount: payoutAmountCents / 100,
            currency: currency.toUpperCase(),
            status: payout.status,
            arrivalDate: payout.arrival_date,
            message: `提现已发起，预计 ${new Date(payout.arrival_date * 1000).toLocaleDateString()} 到账`
        });

    } catch (error: any) {
        console.error('[Seller Payout] Error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({
                error: 'Payout failed',
                message: error.message,
                code: error.code
            });
        }

        res.status(500).json({ error: 'Payout failed', message: error.message });
    }
});

/**
 * GET /api/stripe/seller-payouts
 * Get seller's payout history
 */
router.get('/api/stripe/seller-payouts', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10 } = req.query;

        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.json({ payouts: [], hasAccount: false });
        }

        // List payouts from seller's connected account
        const payouts = await getStripe().payouts.list({
            limit: parseInt(limit as string)
        }, {
            stripeAccount: seller.stripe_connect_id
        });

        const formattedPayouts = payouts.data.map(p => ({
            id: p.id,
            amount: p.amount / 100,
            currency: p.currency.toUpperCase(),
            status: p.status,
            arrivalDate: p.arrival_date,
            created: p.created,
            method: p.method,
            type: p.type
        }));

        res.json({
            payouts: formattedPayouts,
            hasMore: payouts.has_more
        });

    } catch (error: any) {
        console.error('[Seller Payouts List] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve payouts', message: error.message });
    }
});

// Legacy endpoints for backward compatibility
router.post('/api/stripe/create-express-account', requireAuth, async (req: any, res) => {
    // Redirect to V2 endpoint
    req.url = '/api/stripe/v2/create-account';
    return res.redirect(307, '/api/stripe/v2/create-account');
});

router.get('/api/stripe/express-status', requireAuth, async (req: any, res) => {
    // Forward to V2 endpoint
    req.url = '/api/stripe/v2/account-status';
    return res.redirect(307, '/api/stripe/v2/account-status');
});

router.post('/api/stripe/create-payment-intent', requireAuth, async (req: any, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.id;

        const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (order.status !== 'pending_payment') return res.status(400).json({ error: 'Invalid order status' });

        const paymentIntent = await getStripe().paymentIntents.create({
            amount: Math.round(order.total_amount * 100),
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
            .select('id, buyer_id, status, total_amount, currency, stripe_payment_intent_id')
            .eq('id', orderId)
            .maybeSingle();
        if (loadError) throw loadError;
        if (!existing) return res.status(404).json({ error: 'Order not found' });
        if (existing.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (existing.status !== 'pending_payment') {
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

        const { data: order, error } = await supabase
            .from('orders')
            .update({ status: 'paid', payment_captured: true, stripe_payment_intent_id: paymentIntent.id })
            .eq('id', orderId)
            .eq('buyer_id', userId)
            .eq('status', 'pending_payment')
            .select()
            .single();

        if (error) throw error;

        await supabase.from('order_timeline').insert({
            order_id: orderId, event_type: 'payment_confirmed', description: 'Payment Confirmed', created_by: userId, metadata: { payment_intent_id: paymentIntentId }
        });

        res.json({ success: true, order });
    } catch (error: any) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: 'Failed to confirm payment', message: error.message });
    }
});
