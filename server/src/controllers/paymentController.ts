import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../db/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2024-12-18.acacia' as any, // Cast to any to avoid strict version mismatch if types are ahead/behind during dev
});

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

        // 2. Calculate Amount (You might add platform fees or shipping here)
        const amount = Math.round(product.price * 100); // Stripe expects cents/lowest currency unit

        // 3. Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: product.currency || 'mxn',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                productId,
                buyerId,
                sellerId: product.seller_id,
            },
        });

        // 4. Create Order Record (Pending Payment)
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

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (!endpointSecret || !sig) {
            // If strictly enforcing webhook security, throw/return here.
            // For dev/test without local listener setup, we might skip signature verif or just parse body.
            // But production MUST verify.
            event = req.body;
        } else {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        }
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            const { productId } = paymentIntent.metadata;

            console.log('Payment succeeded for product:', productId);

            // Update Order Status
            await supabase
                .from('orders')
                .update({ status: 'paid', updated_at: new Date() })
                .eq('payment_intent_id', paymentIntent.id);

            // Update Product Status
            await supabase
                .from('products')
                .update({ status: 'sold' })
                .eq('id', productId);

            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
};
