import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: [
        // 本地开发
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        // 生产环境
        'https://descu.ai',
        'https://www.descu.ai',
        // Vercel预览部署
        /https:\/\/.*\.vercel\.app$/,
        // 或者允许所有域名（仅用于测试）
        // '*'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' })); // Increase limit for image uploads

import { supabase } from './db/supabase';

// Routes
import { analyzeImage } from './controllers/aiController';
import { createProduct, getProducts } from './controllers/productController';
import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead
} from './controllers/chatController';

// Admin imports
import { requireAdmin } from './middleware/adminAuth';
import {
    getDashboardStats,
    getAdminInfo,
    getAdminLogs,
    getReportsData,
    getSystemSettings,
    updateSystemSettings,
    batchUpdateSettings
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
app.post('/api/products', createProduct);
app.get('/api/products', getProducts);

// Chat Endpoints
app.post('/api/conversations', createConversation);
app.get('/api/conversations/:userId', getUserConversations);
app.post('/api/messages', sendMessage);
app.get('/api/messages/:conversationId', getMessages);
app.get('/api/messages/:conversationId', getMessages);
app.put('/api/messages/:conversationId/read', markMessagesAsRead);

// Payment Endpoints
import { createPaymentIntent, handleStripeWebhook, createConnectAccount, getLoginLink } from './controllers/paymentController';
app.post('/api/payment/create-intent', createPaymentIntent);
app.post('/api/payment/connect', createConnectAccount);
app.get('/api/payment/dashboard/:userId', getLoginLink);
// Webhook needs raw body for signature verification if using constructEvent, 
// using express.raw() middleware specifically for this route is best practice or handle in controller with JSON for logic.
// For now, assuming standard JSON handling or adding middleware if strictly needed later.
app.post('/api/payment/webhook', handleStripeWebhook);

// Admin Endpoints - All require admin authentication
// Dashboard
app.get('/api/admin/dashboard/stats', requireAdmin, getDashboardStats);
app.get('/api/admin/auth/me', requireAdmin, getAdminInfo);
app.get('/api/admin/logs', requireAdmin, getAdminLogs);

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


app.get('/', (req, res) => {
    res.send('DESCU Marketplace API is running');
});

app.listen(Number(port), () => {
    console.log(`Server starting...`);
    console.log(`env.PORT currently is: ${process.env.PORT}`);
    console.log(`Server explicitly listening on port ${port}`);
});
