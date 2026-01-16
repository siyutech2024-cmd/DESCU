import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for CORS
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
// This MUST come before express.json() for global routes.
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Standard JSON parsing for everything else
app.use(express.json({ limit: '10mb' }));

import { supabase } from './db/supabase';

// Routes
import { analyzeImage } from './controllers/aiController';
import { createProduct, getProducts, getProductById } from './controllers/productController';
import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead
} from './controllers/chatController';

// Middleware Imports
import { requireAdmin } from './middleware/adminAuth';
import { requireAuth } from './middleware/userAuth'; // New User Auth

// Admin Controller Imports...
import {
    getDashboardStats,
    getAdminInfo,
    getAdminLogs,
    getReportsData,
    getSystemSettings,
    updateSystemSettings,
    batchUpdateSettings,
    getAdminOrders,
    getAdminDisputes,
    resolveDispute,
    markOrderAsPaid
} from './controllers/adminController';
import {
    getAdminProducts,
    getAdminProduct,
    updateAdminProduct,
    deleteAdminProduct,
    restoreAdminProduct,
    updateProductStatus,
    updateProductPromotion,
    batchUpdateProducts
} from './controllers/adminProductController';
import {
    getAdminUsers,
    getAdminUser,
    updateUserVerification,
    deleteAdminUser
} from './controllers/adminUserController';
import {
    getAdminConversations,
    getAdminConversation,
    deleteAdminConversation,
    deleteAdminMessage,
    flagAdminMessage
} from './controllers/adminMessageController';

// API Endpoints
app.post('/api/analyze', analyzeImage);
app.post('/api/products', requireAuth, createProduct);
app.get('/api/products', getProducts);
app.get('/api/products/:id', getProductById);

// Chat Endpoints
app.post('/api/conversations', createConversation);
app.get('/api/conversations/:userId', getUserConversations);
app.post('/api/messages', sendMessage);
app.get('/api/messages/:conversationId', getMessages);
app.put('/api/messages/:conversationId/read', markMessagesAsRead);

// Payment Endpoints
import { createPaymentIntent, handleStripeWebhook, createConnectAccount, getLoginLink, markOrderAsShipped, confirmOrder, getUserOrders, createDispute, verifyPayment, updateSellerBankInfo } from './controllers/paymentController';

// Webhook (No Auth required, uses Signature)
app.post('/api/payment/webhook', handleStripeWebhook);

// Protected Payment & Order Routes (REQUIRE AUTH)
app.post('/api/payment/create-intent', requireAuth, createPaymentIntent);
app.post('/api/payment/connect', requireAuth, createConnectAccount);
app.post('/api/payment/bank-info', requireAuth, updateSellerBankInfo); // NEW Route
app.get('/api/payment/dashboard/:userId', requireAuth, getLoginLink); // userId param checked in controller against req.user
app.post('/api/orders/ship', requireAuth, markOrderAsShipped);
app.post('/api/orders/confirm', requireAuth, confirmOrder);
app.get('/api/orders', requireAuth, getUserOrders);
app.post('/api/disputes', requireAuth, createDispute);
app.post('/api/payment/verify', requireAuth, verifyPayment); // NEW Route

// Admin Endpoints - All require admin authentication
// Dashboard
app.get('/api/admin/dashboard/stats', requireAdmin, getDashboardStats);
app.get('/api/admin/auth/me', requireAdmin, getAdminInfo);
app.get('/api/admin/logs', requireAdmin, getAdminLogs);

// Admin Transaction & Dispute Routes
app.get('/api/admin/orders', requireAdmin, getAdminOrders);
app.post('/api/admin/orders/:id/mark-paid', requireAdmin, markOrderAsPaid); // NEW
app.get('/api/admin/disputes', requireAdmin, getAdminDisputes);
app.post('/api/admin/disputes/resolve', requireAdmin, resolveDispute);

// Product Management
app.get('/api/admin/products', requireAdmin, getAdminProducts);
app.get('/api/admin/products/:id', requireAdmin, getAdminProduct);
app.put('/api/admin/products/:id', requireAdmin, updateAdminProduct);
app.delete('/api/admin/products/:id', requireAdmin, deleteAdminProduct);
app.post('/api/admin/products/:id/restore', requireAdmin, restoreAdminProduct);
app.patch('/api/admin/products/:id/status', requireAdmin, updateProductStatus);
app.patch('/api/admin/products/:id/promote', requireAdmin, updateProductPromotion);
app.post('/api/admin/products/batch', requireAdmin, batchUpdateProducts);

// User Management
app.get('/api/admin/users', requireAdmin, getAdminUsers);
app.get('/api/admin/users/:id', requireAdmin, getAdminUser);
app.patch('/api/admin/users/:id/verify', requireAdmin, updateUserVerification);
app.delete('/api/admin/users/:id', requireAdmin, deleteAdminUser);

// Message Management
app.get('/api/admin/conversations', requireAdmin, getAdminConversations);
app.get('/api/admin/conversations/:id', requireAdmin, getAdminConversation);
app.delete('/api/admin/conversations/:id', requireAdmin, deleteAdminConversation);
app.delete('/api/admin/messages/:id', requireAdmin, deleteAdminMessage);
app.patch('/api/admin/messages/:id/flag', requireAdmin, flagAdminMessage);

// Reports and Analytics
app.get('/api/admin/reports', requireAdmin, getReportsData);

// System Settings
app.get('/api/admin/settings', requireAdmin, getSystemSettings);
app.put('/api/admin/settings', requireAdmin, updateSystemSettings);
app.post('/api/admin/settings/batch', requireAdmin, batchUpdateSettings);


// SEO
import { generateSitemap } from './controllers/seoController';
app.get('/sitemap.xml', generateSitemap);

// Location Proxy
import { reverseGeocodeProxy } from './controllers/locationController';
app.get('/api/location/reverse', reverseGeocodeProxy);

app.get('/', (req, res) => {
    res.send('DESCU Marketplace API is running');
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

app.listen(Number(PORT), () => {
    console.log(`Server starting...`);
    console.log(`env.PORT currently is: ${process.env.PORT}`);
    console.log(`Server explicitly listening on port ${PORT}`);
});
