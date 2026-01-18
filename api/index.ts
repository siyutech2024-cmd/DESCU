import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Imports from Local Lib (Bundled)
import { analyzeImage } from './_lib/controllers/aiController.js';
import { supabase } from './_lib/db/supabase.js';
import { createProduct, getProducts, getProductById, productsHealthCheck } from './_lib/controllers/productController.js';
import { requireAuth } from './_lib/middleware/userAuth.js';
import { requireAdmin } from './_lib/middleware/adminAuth.js';

import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead
} from './_lib/controllers/chatController.js';

import {
    getDashboardStats,
    getAdminInfo,
    getAdminLogs,
    getAdminOrders,
    getAdminDisputes,
    resolveDispute,
    markOrderAsPaid,
    getReportsData,
    getSystemSettings,
    updateSystemSettings,
    batchUpdateSettings
} from './_lib/controllers/adminController.js';

import {
    getAdminProducts,
    getAdminProduct,
    updateAdminProduct,
    deleteAdminProduct,
    restoreAdminProduct,
    updateProductStatus,
    updateProductPromotion,
    batchUpdateProducts
} from './_lib/controllers/adminProductController.js';

import {
    getAdminUsers,
    getAdminUser,
    updateUserVerification,
    deleteAdminUser
} from './_lib/controllers/adminUserController.js';

import {
    getAdminConversations,
    getAdminConversation,
    deleteAdminConversation,
    deleteAdminMessage,
    flagAdminMessage
} from './_lib/controllers/adminMessageController.js';

import {
    createPaymentIntent,
    handleStripeWebhook,
    createConnectAccount,
    getLoginLink,
    markOrderAsShipped,
    confirmOrder,
    createDispute,
    verifyPayment,
    updateSellerBankInfo,
    ordersHealthCheck,
    getUserOrders
} from './_lib/controllers/paymentController.js';

import { generateSitemap } from './_lib/controllers/seoController.js';
import { reverseGeocodeProxy } from './_lib/controllers/locationController.js';

const app = express();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://descu.ai',
        'https://www.descu.ai',
        /https:\/\/.*\.vercel\.app$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// SPECIAL HANDLING: Stripe Webhook requires RAW body.
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// Feature Routes
app.post('/api/analyze', analyzeImage);
app.get('/api/products/health', productsHealthCheck);
app.post('/api/products', requireAuth, createProduct);
app.get('/api/products', getProducts);
app.get('/api/products/:id', getProductById);


// Chat Endpoints
app.post('/api/conversations', createConversation);
app.get('/api/users/:userId/conversations', getUserConversations);
app.post('/api/messages', sendMessage);
app.get('/api/conversations/:conversationId/messages', getMessages);
app.put('/api/messages/:conversationId/read', markMessagesAsRead);


// Payment Endpoints
app.post('/api/payment/webhook', handleStripeWebhook);
app.post('/api/payment/create-intent', requireAuth, createPaymentIntent);
app.post('/api/payment/connect', requireAuth, createConnectAccount);
app.post('/api/payment/bank-info', requireAuth, updateSellerBankInfo);
app.get('/api/payment/dashboard/:userId', requireAuth, getLoginLink);
app.post('/api/orders/ship', requireAuth, markOrderAsShipped);
app.post('/api/orders/confirm', requireAuth, confirmOrder);
app.get('/api/orders/health', ordersHealthCheck);
app.post('/api/disputes', requireAuth, createDispute);
app.post('/api/payment/verify', requireAuth, verifyPayment);
app.get('/api/orders', requireAuth, getUserOrders);

// Admin Endpoints
app.get('/api/admin/dashboard/stats', requireAdmin, getDashboardStats);
app.get('/api/admin/auth/me', requireAdmin, getAdminInfo);
app.get('/api/admin/logs', requireAdmin, getAdminLogs);
app.get('/api/admin/orders', requireAdmin, getAdminOrders);
app.post('/api/admin/orders/:id/mark-paid', requireAdmin, markOrderAsPaid);
app.get('/api/admin/disputes', requireAdmin, getAdminDisputes);
app.post('/api/admin/disputes/resolve', requireAdmin, resolveDispute);

// Admin Product Management
app.get('/api/admin/products', requireAdmin, getAdminProducts);
app.get('/api/admin/products/:id', requireAdmin, getAdminProduct);
app.put('/api/admin/products/:id', requireAdmin, updateAdminProduct);
app.delete('/api/admin/products/:id', requireAdmin, deleteAdminProduct);
app.post('/api/admin/products/:id/restore', requireAdmin, restoreAdminProduct);
app.patch('/api/admin/products/:id/status', requireAdmin, updateProductStatus);
app.patch('/api/admin/products/:id/promote', requireAdmin, updateProductPromotion);
app.post('/api/admin/products/batch', requireAdmin, batchUpdateProducts);

// Admin User Management
app.get('/api/admin/users', requireAdmin, getAdminUsers);
app.get('/api/admin/users/:id', requireAdmin, getAdminUser);
app.patch('/api/admin/users/:id/verify', requireAdmin, updateUserVerification);
app.delete('/api/admin/users/:id', requireAdmin, deleteAdminUser);

// Admin Message Management
app.get('/api/admin/conversations', requireAdmin, getAdminConversations);
app.get('/api/admin/conversations/:id', requireAdmin, getAdminConversation);
app.delete('/api/admin/conversations/:id', requireAdmin, deleteAdminConversation);
app.delete('/api/admin/messages/:id', requireAdmin, deleteAdminMessage);
app.patch('/api/admin/messages/:id/flag', requireAdmin, flagAdminMessage);

// Admin Reports and Settings
app.get('/api/admin/reports', requireAdmin, getReportsData);
app.get('/api/admin/settings', requireAdmin, getSystemSettings);
app.put('/api/admin/settings', requireAdmin, updateSystemSettings);
app.post('/api/admin/settings/batch', requireAdmin, batchUpdateSettings);

// SEO & Location
app.get('/sitemap.xml', generateSitemap);
app.get('/api/location/reverse', reverseGeocodeProxy);

// Rating & Reviews
import { submitRating, getUserRatingStats } from './_lib/controllers/ratingController.js';
app.post('/api/ratings', requireAuth, submitRating);
app.get('/api/ratings/:userId/stats', getUserRatingStats);

// ------------------------------------------------------------------
// INLINED ORDER ROUTES (Hotfix for Vercel 404)
// ------------------------------------------------------------------
app.post('/api/orders/create', requireAuth, async (req: any, res) => {
    try {
        const { productId, orderType, paymentMethod, shippingAddress, meetupLocation, meetupTime } = req.body;
        const buyerId = req.user.id;

        console.log(`[CreateOrder] Received request: productId=${productId}, buyerId=${buyerId}, type=${orderType}`);

        const { data: product, error: pInfoError } = await supabase.from('products').select('*, seller:users!seller_id(*)').eq('id', productId).single();

        if (pInfoError || !product) {
            console.error('[CreateOrder] Product lookup failed:', pInfoError);
            return res.status(404).json({ error: 'Product not found', debug_id: productId, db_error: pInfoError });
        }

        console.log(`[CreateOrder] Product found: ${product.id}, Seller: ${product.seller_id}`);

        if (product.seller_id === buyerId) return res.status(400).json({ error: 'Cannot buy your own product' });

        const productAmount = product.price;
        const shippingFee = orderType === 'shipping' ? 50 : 0;
        const platformFee = paymentMethod === 'online' ? (productAmount * 0.03) : 0;
        const totalAmount = productAmount + shippingFee + platformFee;

        const orderData: any = {
            product_id: productId, buyer_id: buyerId, seller_id: product.seller_id,
            order_type: orderType, payment_method: paymentMethod,
            product_amount: productAmount, shipping_fee: shippingFee, platform_fee: platformFee, total_amount: totalAmount,
            currency: 'MXN', status: paymentMethod === 'cash' ? 'paid' : 'pending_payment',
            expires_at: new Date(Date.now() + 86400000)
        };
        if (orderType === 'shipping') orderData.shipping_address = shippingAddress;
        if (orderType === 'meetup' && meetupLocation) {
            orderData.meetup_location = meetupLocation; orderData.meetup_time = meetupTime;
        }

        const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
        if (orderError) throw orderError;

        await supabase.from('order_timeline').insert({
            order_id: order.id, event_type: 'created', description: `Order Created (${orderType})`, created_by: buyerId, metadata: { orderType, paymentMethod }
        });

        // Auto-create chat
        const { data: conversation } = await supabase.from('conversations').select().eq('product_id', productId).eq('buyer_id', buyerId).eq('seller_id', product.seller_id).single();
        if (!conversation) {
            await supabase.from('conversations').insert({ product_id: productId, buyer_id: buyerId, seller_id: product.seller_id });
        }

        res.json({ order, success: true, requiresPayment: paymentMethod === 'online' });
    } catch (error: any) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order', message: error.message });
    }
});

app.get('/api/orders', requireAuth, async (req: any, res) => {
    try {
        const { role, product_id, buyer_id } = req.query;
        const userId = req.user.id;
        let query = supabase.from('orders').select('*, product:products(*), buyer:users!buyer_id(*), seller:users!seller_id(*)').order('created_at', { ascending: false });

        if (product_id) query = query.eq('product_id', product_id);
        if (buyer_id) query = query.eq('buyer_id', buyer_id);
        if (role === 'buyer') query = query.eq('buyer_id', userId);
        else if (role === 'seller') query = query.eq('seller_id', userId);
        else if (!product_id) query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

        const { data: orders, error } = await query;
        if (error) throw error;
        res.json({ orders });
    } catch (error: any) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to get orders', message: error.message });
    }
});

app.get('/api/orders/:id', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { data: order, error } = await supabase.from('orders')
            .select('*, product:products(*), buyer:users!buyer_id(*), seller:users!seller_id(*), timeline:order_timeline(*)')
            .eq('id', id).single();

        if (error || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId && order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        res.json({ order });
    } catch (error: any) {
        console.error('Get order detail error:', error);
        res.status(500).json({ error: 'Failed to get order', message: error.message });
    }
});

app.post('/api/orders/:id/confirm', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const isBuyer = order.buyer_id === userId;
        const isSeller = order.seller_id === userId;
        if (!isBuyer && !isSeller) return res.status(403).json({ error: 'Unauthorized' });

        const updateData: any = {};
        if (isBuyer && !order.buyer_confirmed_at) updateData.buyer_confirmed_at = new Date().toISOString();
        if (isSeller && !order.seller_confirmed_at) updateData.seller_confirmed_at = new Date().toISOString();

        if (Object.keys(updateData).length === 0) return res.json({ message: 'Already confirmed', order });

        const { data: updatedOrder, error } = await supabase.from('orders').update(updateData).eq('id', id).select().single();
        if (error) throw error;

        await supabase.from('order_timeline').insert({
            order_id: id, event_type: isBuyer ? 'buyer_confirmed' : 'seller_confirmed', description: `${isBuyer ? 'Buyer' : 'Seller'} confirmed`, created_by: userId
        });

        if (updatedOrder.buyer_confirmed_at && updatedOrder.seller_confirmed_at) {
            const { data: completedOrder } = await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id).select().single();
            await supabase.from('order_timeline').insert({ order_id: id, event_type: 'completed', description: 'Order Completed', created_by: userId });
            return res.json({ message: 'Order Completed', order: completedOrder, completed: true });
        }

        res.json({ message: 'Confirmed, waiting for other party', order: updatedOrder, completed: false });
    } catch (error: any) {
        console.error('Confirm order error:', error);
        res.status(500).json({ error: 'Failed to confirm', message: error.message });
    }
});

app.post('/api/orders/:id/arrange-meetup', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { location, time, lat, lng } = req.body;
        const userId = req.user.id;

        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId && order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (order.order_type !== 'meetup') return res.status(400).json({ error: 'Not a meetup order' });

        const { data: updatedOrder, error } = await supabase.from('orders').update({
            meetup_location: location, meetup_time: time, meetup_location_lat: lat, meetup_location_lng: lng, status: 'meetup_arranged',
            meetup_confirmed_by_buyer: false, meetup_confirmed_by_seller: false
        }).eq('id', id).select().single();
        if (error) throw error;
        await supabase.from('order_timeline').insert({
            order_id: id, event_type: 'meetup_arranged', description: `Meetup Arranged: ${location}`, created_by: userId, metadata: { location, time }
        });
        res.json({ order: updatedOrder });
    } catch (error: any) {
        console.error('Arrange meetup error:', error);
        res.status(500).json({ error: 'Failed to arrange meetup', message: error.message });
    }
});

// ------------------------------------------------------------------
// INLINED USER ADDRESS ROUTES (Hotfix for Vercel 404)
// ------------------------------------------------------------------
app.get('/api/users/addresses', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ addresses: data || [] });
    } catch (error: any) {
        console.error('Fetch addresses error:', error);
        res.status(500).json({ error: 'Failed to fetch addresses', message: error.message });
    }
});

app.post('/api/users/addresses', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { recipient_name, phone_number, street_address, city, state, zip_code, country, is_default } = req.body;

        if (!recipient_name || !phone_number || !street_address || !city || !state || !zip_code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (is_default) {
            await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        }

        const { data, error } = await supabase
            .from('user_addresses')
            .insert({
                user_id: userId,
                recipient_name,
                phone_number,
                street_address,
                city,
                state,
                zip_code,
                country: country || 'MX',
                is_default: is_default || false
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ address: data });
    } catch (error: any) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Failed to add address', message: error.message });
    }
});

app.put('/api/users/addresses/:id', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updates = req.body;
        delete updates.user_id;
        delete updates.id;
        delete updates.created_at;

        if (updates.is_default) {
            await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        }

        const { data, error } = await supabase
            .from('user_addresses')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        res.json({ address: data });
    } catch (error: any) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Failed to update address', message: error.message });
    }
});

app.delete('/api/users/addresses/:id', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { error } = await supabase
            .from('user_addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Failed to delete address', message: error.message });
    }
});
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// INLINED STRIPE ROUTES (Hotfix for Vercel 404)
// ------------------------------------------------------------------
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover' as any, // Cast to match local
});

app.post('/api/stripe/add-bank-account', requireAuth, async (req: any, res) => {
    try {
        const { accountHolderName, accountNumber, routingNumber, accountHolderType = 'individual' } = req.body;
        const userId = req.user.id; // requireAuth populates this

        const { data: existingAccount } = await supabase.from('stripe_accounts').select().eq('user_id', userId).single();
        let stripeAccountId: string;

        if (existingAccount?.stripe_account_id) {
            stripeAccountId = existingAccount.stripe_account_id;
        } else {
            const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).single();
            const account = await stripe.accounts.create({
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

        const bankAccount = await stripe.accounts.createExternalAccount(stripeAccountId, {
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

app.get('/api/stripe/account-status', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data: account } = await supabase.from('stripe_accounts').select().eq('user_id', userId).single();

        if (!account) return res.json({ hasAccount: false, verified: false });

        const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
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

app.post('/api/stripe/create-payment-intent', requireAuth, async (req: any, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.id;

        const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (order.status !== 'pending_payment') return res.status(400).json({ error: 'Invalid order status' });

        const paymentIntent = await stripe.paymentIntents.create({
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

app.post('/api/stripe/confirm-payment', requireAuth, async (req: any, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;
        const userId = req.user.id;
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') return res.status(400).json({ error: 'Payment not succeeded' });

        const { data: order, error } = await supabase.from('orders').update({ status: 'paid', payment_captured: true })
            .eq('id', orderId).eq('buyer_id', userId).select().single();

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

// Test Route
app.get('/api/test_ping', (req, res) => {
    const debug: any = {
        pong: true,
        time: new Date().toISOString(),
        location: 'api/index.ts inlined',
        fs: {}
    };

    try {
        const root = process.cwd();
        debug.fs.cwd = root;

        // Check api folder
        const apiPath = path.join(root, 'api');
        if (fs.existsSync(apiPath)) {
            debug.fs.api = fs.readdirSync(apiPath);

            // Check _lib
            const libPath = path.join(apiPath, '_lib');
            if (fs.existsSync(libPath)) {
                debug.fs.lib = fs.readdirSync(libPath);

                // Check controllers
                const ctrlPath = path.join(libPath, 'controllers');
                if (fs.existsSync(ctrlPath)) {
                    debug.fs.controllers = fs.readdirSync(ctrlPath);
                } else {
                    debug.fs.controllers = 'NOT_FOUND';
                }
            } else {
                debug.fs.lib = 'NOT_FOUND';
            }
        } else {
            debug.fs.api = 'NOT_FOUND';
        }

    } catch (e: any) {
        debug.fs_error = e.message;
    }

    res.json(debug);
});

app.get('/', (req, res) => {
    res.send('DESCU API (Inlined)');
});

export default app;
