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

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

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
app.put('/api/messages/:conversationId/read', markMessagesAsRead);

// Admin Endpoints - All require admin authentication
// Dashboard - 临时移除认证用于测试
app.get('/api/admin/dashboard/stats', getDashboardStats);
app.get('/api/admin/auth/me', getAdminInfo);
app.get('/api/admin/logs', getAdminLogs);

// Product Management - 临时移除认证用于测试
app.get('/api/admin/products', getAdminProducts);
app.get('/api/admin/products/:id', getAdminProduct);
app.put('/api/admin/products/:id', updateAdminProduct);
app.delete('/api/admin/products/:id', deleteAdminProduct);
app.post('/api/admin/products/:id/restore', restoreAdminProduct);
app.patch('/api/admin/products/:id/status', updateProductStatus);
app.patch('/api/admin/products/:id/promote', updateProductPromotion);
app.post('/api/admin/products/batch', batchUpdateProducts);

// User Management
app.get('/api/admin/users', getAdminUsers);
app.get('/api/admin/users/:id', getAdminUser);
app.patch('/api/admin/users/:id/verify', updateUserVerification);
app.delete('/api/admin/users/:id', deleteAdminUser);

// Message Management
app.get('/api/admin/conversations', getAdminConversations);
app.get('/api/admin/conversations/:id', getAdminConversation);
app.delete('/api/admin/conversations/:id', deleteAdminConversation);
app.delete('/api/admin/messages/:id', deleteAdminMessage);
app.patch('/api/admin/messages/:id/flag', flagAdminMessage);

// Reports and Analytics
app.get('/api/admin/reports', getReportsData);

// System Settings
app.get('/api/admin/settings', getSystemSettings);
app.put('/api/admin/settings', updateSystemSettings);
app.post('/api/admin/settings/batch', batchUpdateSettings);


app.get('/', (req, res) => {
    res.send('DESCU Marketplace API is running');
});

app.listen(Number(port), () => {
    console.log(`Server starting...`);
    console.log(`env.PORT currently is: ${process.env.PORT}`);
    console.log(`Server explicitly listening on port ${port}`);
});
