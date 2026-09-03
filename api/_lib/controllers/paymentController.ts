import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/userAuth.js';
import { getAuthClient } from '../utils/supabaseHelper.js';
import { confirmBlockReason, isPaymentSettled } from '../domain/orders.js';
import { releaseEscrow } from '../services/escrowReleaseService.js';
import { processStripeEvent } from '../services/stripeWebhookService.js';

export const ordersHealthCheck = (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        message: 'Payment controller loaded',
        env: {
            hasStripe: !!process.env.STRIPE_SECRET_KEY,
            hasSupabase: !!process.env.SUPABASE_URL
        }
    });
};

// --- LAYZ STRIPE INIT ---
let stripeInstance: Stripe | null = null;

const getStripe = () => {
    if (!stripeInstance) {
        const key = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
        if (!process.env.STRIPE_SECRET_KEY) {
            console.warn('[Stripe] Missing STRIPE_SECRET_KEY, using placeholder');
        }
        try {
            stripeInstance = new Stripe(key, {
                apiVersion: '2024-12-18.acacia' as any,
            });
            console.log('[Stripe] Initialized successfully');
        } catch (error) {
            console.error('[Stripe] Initialization Failed:', error);
            throw error;
        }
    }
    return stripeInstance;
};

// --- CONNECT: ONBOARDING ---

export const createConnectAccount = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id; // Use authenticated ID
        const email = authReq.user?.email || req.body.email; // Fallback to body email if auth email missing, but ID must be auth

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Check if seller record exists
        let { data: seller } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', userId)
            .single();

        let accountId = seller?.stripe_connect_id;

        // 2. If not, create Stripe Account
        if (!accountId) {
            const account = await getStripe().accounts.create({
                type: 'express',
                country: 'MX', // Defaulting to Mexico
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            });
            accountId = account.id;

            // Save to DB
            const { error: upsertError } = await supabase
                .from('sellers')
                .upsert({
                    user_id: userId,
                    stripe_connect_id: accountId,
                    onboarding_complete: false
                });

            if (upsertError) throw upsertError;
        }

        // 3. Create Account Link (for onboarding)
        const accountLink = await getStripe().accountLinks.create({
            account: accountId,
            refresh_url: `${req.headers.origin}/profile?onboarding_refresh=true`,
            return_url: `${req.headers.origin}/profile?onboarding_success=true`,
            type: 'account_onboarding',
        });

        res.json({ url: accountLink.url });

    } catch (error: any) {
        console.error('Error creating connect account:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getLoginLink = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const paramId = req.params.userId;

        // Security check: only allow own dashboard link
        if (!userId || userId !== paramId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Fetch seller
        const { data: seller } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!seller || !seller.stripe_connect_id) {
            return res.status(404).json({ error: 'Seller account not found' });
        }

        const loginLink = await getStripe().accounts.createLoginLink(seller.stripe_connect_id);
        res.json({ url: loginLink.url });

    } catch (error: any) {
        console.error('Error creating login link:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update Seller Bank Info (Manual Payout)
export const updateSellerBankInfo = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const { bankName, accountNumber, holderName } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { error } = await supabase
            .from('sellers')
            .upsert({
                user_id: userId,
                bank_name: bankName,
                account_number: accountNumber,
                account_holder_name: holderName,
                onboarding_complete: true // Mark as ready since they provided bank info
            });

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error updating bank info:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createPaymentIntent = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const buyerId = authReq.user?.id; // TRUSTED ID
        const { productId } = req.body;

        if (!productId || !buyerId) {
            return res.status(400).json({ error: 'Missing productId or not authenticated' });
        }

        // 1. Fetch Product Details
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.status === 'sold') {
            return res.status(400).json({ error: 'Product already sold' });
        }

        // Prevent buying own product
        if (product.seller_id === buyerId) {
            return res.status(400).json({ error: 'Cannot buy your own product' });
        }

        // 2. Fetch Seller Connect ID
        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete')
            .eq('user_id', product.seller_id)
            .single();

        // 3. Calculate Amount
        const amount = Math.round(product.price * 100);

        // 4. Create Payment Intent (FUNDS HELD ON PLATFORM)
        const paymentParams: Stripe.PaymentIntentCreateParams = {
            amount,
            currency: product.currency || 'mxn',
            automatic_payment_methods: { enabled: true },
            metadata: {
                productId,
                buyerId,
                sellerId: product.seller_id,
                sellerConnectId: seller?.stripe_connect_id || '',
            },
        };

        const paymentIntent = await getStripe().paymentIntents.create(paymentParams);

        // 5. Create Order Record
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                buyer_id: buyerId,
                seller_id: product.seller_id,
                product_id: productId,
                amount: product.price,
                currency: product.currency || 'MXN',
                status: 'pending_payment',
                payment_intent_id: paymentIntent.id,
                shipping_carrier: null, // Init
                tracking_number: null
            })
            .select()
            .single();

        if (orderError) {
            console.error('Error creating order:', orderError);
            return res.status(500).json({ error: `Failed to create order record: ${orderError.message}`, details: orderError });
        }

        res.json({
            clientSecret: paymentIntent.client_secret,
            orderId: order.id
        });

    } catch (error: any) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: error.message });
    }
};

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
// Get User Orders (Buyer or Seller)
// Get User Orders (Buyer or Seller)
export const getUserOrders = async (req: Request, res: Response) => {
    console.log('[Orders] Fetching orders request received');
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const authHeader = req.headers.authorization;
        const { role } = req.query;

        console.log(`[Orders] UserID: ${userId}, Role: ${role}, AuthHeaderLen: ${authHeader?.length}`);

        if (!userId || !authHeader) {
            console.error('[Orders] Unauthorized: Missing userId or authHeader');
            return res.status(401).json({ error: 'Unauthorized: Missing credentials' });
        }


        // Use Authenticated Client
        // Use Authenticated Client
        let client;
        try {
            client = getAuthClient(authHeader);
            console.log('[Orders] Client created successfully');
        } catch (clientError: any) {
            console.error('[Orders] Client creation failed:', clientError);
            throw new Error(`Supabase Client Error: ${clientError.message}`);
        }

        // 1. Fetch Orders
        let query = client
            .from('orders')
            .select('*, products(*)');

        if (role === 'seller') {
            query = query.eq('seller_id', userId);
        } else if (role === 'buyer') {
            query = query.eq('buyer_id', userId);
        } else {
            query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
        }

        console.log('[Orders] Executing Supabase query...');
        const { data: orders, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('[Orders] Supabase Query Error:', JSON.stringify(error));
            throw error;
        }

        console.log(`[Orders] Found ${orders?.length || 0} orders`);

        if (!orders || orders.length === 0) {
            return res.json({ orders: [] });
        }

        // 2. Manual Data Joining
        // Simplified for stability: Skip admin email fetch if risk of crash
        // const enrichedOrders = ... (logic)

        // For now, return raw orders to verify connection first
        // If this works, we know query is fine.
        console.log('[Orders] Returning orders');
        res.json({ orders });

    } catch (error: any) {
        console.error('[Orders] Critical Error:', error);
        res.status(500).json({
            error: 'Failed to fetch orders',
            details: error.message,
            stack: error.stack,
            envCheck: {
                hasSupabaseUrl: !!process.env.SUPABASE_URL,
                hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
                hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
            }
        });
    }
};


// Verify Payment Status (Manual Sync)
export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        const { orderId, paymentIntentId } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        if (!orderId && !paymentIntentId) {
            return res.status(400).json({ error: 'Missing orderId or paymentIntentId' });
        }

        let order;
        // Find order
        if (orderId) {
            const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single();
            order = o;
        } else {
            const { data: o } = await supabase.from('orders').select('*').eq('payment_intent_id', paymentIntentId).single();
            order = o;
        }

        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Check Stripe
        const paymentIntent = await getStripe().paymentIntents.retrieve(order.payment_intent_id);

        if (paymentIntent.status === 'succeeded') {
            // Update DB
            if (order.status !== 'paid' && order.status !== 'shipped' && order.status !== 'completed') {
                await supabase
                    .from('orders')
                    .update({ status: 'paid', updated_at: new Date() })
                    .eq('id', order.id);

                // Update Product to sold
                await supabase
                    .from('products')
                    .update({ status: 'sold' })
                    .eq('id', order.product_id);

                return res.json({ success: true, status: 'paid' });
            }
        }

        res.json({ success: true, status: order.status, stripeStatus: paymentIntent.status });

    } catch (error: any) {
        console.error('Verify Payment Error:', error);
        res.status(500).json({ error: error.message });
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
