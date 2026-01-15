import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../db/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2024-12-18.acacia' as any,
});

// --- CONNECT: ONBOARDING ---

export const createConnectAccount = async (req: Request, res: Response) => {
    try {
        const { userId, email } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ error: 'Missing userId or email' });
        }

        // 1. Check if seller record exists
        let { data: seller, error: fetchError } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', userId)
            .single();

        let accountId = seller?.stripe_connect_id;

        // 2. If not, create Stripe Account
        if (!accountId) {
            const account = await stripe.accounts.create({
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
        const accountLink = await stripe.accountLinks.create({
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
        const { userId } = req.params;

        // Fetch seller
        const { data: seller } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!seller || !seller.stripe_connect_id) {
            return res.status(404).json({ error: 'Seller account not found' });
        }

        const loginLink = await stripe.accounts.createLoginLink(seller.stripe_connect_id);
        res.json({ url: loginLink.url });

    } catch (error: any) {
        console.error('Error creating login link:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- PAYMENTS & ORDERS (ESCROW) ---

export const createPaymentIntent = async (req: Request, res: Response) => {
    try {
        const { productId, buyerId } = req.body;

        if (!productId || !buyerId) {
            return res.status(400).json({ error: 'Missing productId or buyerId' });
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

        // 2. Fetch Seller Connect ID (Check existence, but do NOT transfer yet)
        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete')
            .eq('user_id', product.seller_id)
            .single();

        // 3. Calculate Amount
        const amount = Math.round(product.price * 100);

        // 4. Create Payment Intent (FUNDS HELD ON PLATFORM)
        // We do NOT add transfer_data here. We hold the funds.
        const paymentParams: Stripe.PaymentIntentCreateParams = {
            amount,
            currency: product.currency || 'mxn',
            automatic_payment_methods: { enabled: true },
            metadata: {
                productId,
                buyerId,
                sellerId: product.seller_id,
                sellerConnectId: seller?.stripe_connect_id || '', // Store for later
            },
        };

        const paymentIntent = await stripe.paymentIntents.create(paymentParams);

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
            })
            .select()
            .single();

        if (orderError) {
            console.error('Error creating order:', orderError);
            return res.status(500).json({ error: 'Failed to create order record' });
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
        const { orderId, carrier, trackingNumber } = req.body;

        // In real app: verify requester is the seller via req.user

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

// Confirm Receipt & Release Funds
export const confirmOrder = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body;

        // 1. Get Order
        // Join sellers to get connect ID
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.status === 'completed') {
            return res.status(400).json({ error: 'Order already completed' });
        }

        // 2. Transfer Funds to Seller (Platform Fee: 5%)
        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id')
            .eq('user_id', order.seller_id)
            .single();

        if (seller && seller.stripe_connect_id) {
            const amount = Math.round(order.amount * 100);
            const platformFee = Math.round(amount * 0.05);
            const transferAmount = amount - platformFee;

            // Create Transfer
            try {
                await stripe.transfers.create({
                    amount: transferAmount,
                    currency: order.currency.toLowerCase(),
                    destination: seller.stripe_connect_id,
                    metadata: { orderId: order.id }
                });
            } catch (err) {
                console.error("Stripe Transfer failed:", err);
                // We might proceed to update state but log error, or fail here.
                // For safety, let's allow failing but manual retry.
                throw err;
            }
        }

        // 3. Update Order Status
        await supabase
            .from('orders')
            .update({
                status: 'completed',
                confirmed_at: new Date(),
                updated_at: new Date()
            })
            .eq('id', orderId);

        res.json({ success: true });

    } catch (error: any) {
        console.error("Payout failed:", error);
        res.status(500).json({ error: error.message });
    }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (!endpointSecret || !sig) {
            event = req.body;
        } else {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        }
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'account.updated') {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.payouts_enabled) {
            await supabase
                .from('sellers')
                .update({ onboarding_complete: true })
                .eq('stripe_connect_id', account.id);
        }
    }

    // Handle payments
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { productId } = paymentIntent.metadata;

        console.log('Payment succeeded for product:', productId);

        // Mark as PAID (Escrowed)
        await supabase
            .from('orders')
            .update({ status: 'paid', updated_at: new Date() })
            .eq('payment_intent_id', paymentIntent.id);

        await supabase
            .from('products')
            .update({ status: 'sold' })
            .eq('id', productId);
    }

    res.send();
};
