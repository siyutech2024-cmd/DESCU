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
    } catch (error) {
        console.error('Fetch addresses error:', error);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
});

app.post('/api/users/addresses', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { recipient_name, phone_number, street_address, city, state, zip_code, country, is_default } = req.body;

        if (!recipient_name || !phone_number || !street_address || !city || !state || !zip_code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // If setting as default, unset others first (optional, but good practice, though trigger handles it usually)
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
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Failed to add address' });
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
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Failed to update address' });
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
    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Failed to delete address' });
    }
});
// ------------------------------------------------------------------

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
