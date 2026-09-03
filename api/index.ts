import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Imports from Local Lib (Bundled)
import { analyzeImage } from './_lib/controllers/aiController.js';
import { supabase, getSupabase } from './_lib/db/supabase.js';
import { createProduct, getProducts, getProductById, productsHealthCheck } from './_lib/controllers/productController.js';
import { requireAuth } from './_lib/middleware/userAuth.js';
import { requireAdmin } from './_lib/middleware/adminAuth.js';

import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead,
    deleteConversation
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

import { generateSitemap, generateLlmsFull, notifyIndexNow, pingGoogleSitemap } from './_lib/controllers/seoController.js';
import { reverseGeocodeProxy } from './_lib/controllers/locationController.js';
import { autoReviewPendingProducts } from './_lib/services/auditService.js';
import { batchTranslateProducts } from './_lib/services/batchTranslateService.js';

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
app.get('/api/conversations/:conversationId/messages', getMessages); // Old route
app.get('/api/messages/:conversationId', getMessages); // New route - matches frontend
app.put('/api/messages/:conversationId/read', markMessagesAsRead);
app.delete('/api/conversations/:conversationId', deleteConversation);


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

app.get('/api/users/:userId/credit', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('credit_scores')
            .select('score')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({ score: data?.score || 500 }); // Default start score
    } catch (error: any) {
        console.error('Get credit score error:', error);
        res.status(500).json({ error: 'Failed to get credit score', message: error.message });
    }
});

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

// ==================================================================
// ADMIN MANUAL TRIGGER - 管理员手动触发
// ==================================================================

/**
 * 管理员手动触发AI审核
 * 在后台可以直接触发，无需等待定时任务
 * 支持开发模式 (X-Dev-Mode header)
 */
app.post('/api/admin/trigger-review', async (req: any, res, next) => {
    // 检查是否是开发模式
    const isDevMode = req.headers['x-dev-mode'] === 'true';

    if (isDevMode) {
        // 开发模式：跳过认证，直接执行
        console.log('[Admin] Dev mode AI review triggered');
        req.admin = { id: 'dev-admin', email: 'admin@local.com', role: 'admin' };
        return handleTriggerReview(req, res);
    }

    // 正常模式：需要认证
    return requireAdmin(req, res, () => handleTriggerReview(req, res));
});

// 抽取处理逻辑为单独函数
async function handleTriggerReview(req: any, res: any) {
    try {
        console.log('[Admin] Manual AI review triggered by admin:', req.admin?.id);

        // 检查 AI 配置状态
        const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

        if (!hasGeminiKey) {
            return res.status(503).json({
                error: 'AI service not configured',
                message: 'GEMINI_API_KEY environment variable is not set'
            });
        }

        // 执行自动审核
        const stats = await autoReviewPendingProducts(50);

        console.log('[Admin] Manual AI review completed:', stats);

        res.json({
            success: true,
            message: 'AI review completed',
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('[Admin] Manual AI review failed:', error);
        res.status(500).json({
            error: 'AI review failed',
            message: error.message
        });
    }
}

/**
 * 获取 AI 服务状态
 */
app.get('/api/admin/ai-status', requireAdmin, async (req: any, res) => {
    const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
    const hasCronSecret = !!process.env.CRON_SECRET;

    // 获取待审核商品数量
    const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review');

    res.json({
        aiConfigured: hasGeminiKey,
        cronConfigured: hasCronSecret,
        pendingReviewCount: count || 0,
        message: hasGeminiKey
            ? 'AI service is configured and ready'
            : 'GEMINI_API_KEY is not configured - AI review will not work'
    });
});

/**
 * 诊断端点：测试数据库更新权限
 */
app.get('/api/admin/db-test', async (req: any, res) => {
    // 开发模式检查
    const isDevMode = req.headers['x-dev-mode'] === 'true';
    if (!isDevMode) {
        return res.status(403).json({ error: 'Dev mode required' });
    }

    try {
        const sb = getSupabase();

        // 1. 测试读取
        const { data: products, error: readError } = await sb
            .from('products')
            .select('id, title, status, review_note')
            .eq('status', 'pending_review')
            .limit(1);

        if (readError) {
            return res.json({
                success: false,
                stage: 'read',
                error: readError.message,
                hint: readError.hint
            });
        }

        if (!products || products.length === 0) {
            return res.json({
                success: true,
                stage: 'read',
                message: 'No pending products to test update'
            });
        }

        const testProduct = products[0];

        // 2. 测试更新 (只更新 review_note 不改变 status)
        const testNote = `[DB Test] ${new Date().toISOString()}`;
        const { error: updateError } = await sb
            .from('products')
            .update({ review_note: testNote })
            .eq('id', testProduct.id);

        if (updateError) {
            return res.json({
                success: false,
                stage: 'update',
                productId: testProduct.id,
                error: updateError.message,
                hint: updateError.hint,
                code: updateError.code
            });
        }

        // 3. 验证更新成功
        const { data: updated } = await sb
            .from('products')
            .select('id, review_note')
            .eq('id', testProduct.id)
            .single();

        res.json({
            success: true,
            stage: 'complete',
            productId: testProduct.id,
            originalNote: testProduct.review_note,
            updatedNote: updated?.review_note,
            updateWorked: updated?.review_note === testNote
        });

    } catch (err: any) {
        res.status(500).json({
            success: false,
            stage: 'exception',
            error: err.message
        });
    }
});

// ==================================================================
// CRON JOBS - 定时任务
// ==================================================================

/**
 * AI 测试端点：使用真实待审核产品测试完整审核流程
 */
app.get('/api/admin/ai-test', async (req: any, res) => {
    const isDevMode = req.headers['x-dev-mode'] === 'true';
    if (!isDevMode) {
        return res.status(403).json({ error: 'Dev mode required' });
    }

    try {
        const { auditProduct } = await import('./_lib/services/auditService.js');
        const sb = getSupabase();

        // 获取一个真实的待审核产品
        const { data: products, error: queryError } = await sb
            .from('products')
            .select('id, title, description, category')
            .eq('status', 'pending_review')
            .limit(1);

        if (queryError) {
            return res.json({
                success: false,
                stage: 'query',
                error: queryError.message
            });
        }

        if (!products || products.length === 0) {
            return res.json({
                success: false,
                stage: 'query',
                error: 'No pending products found'
            });
        }

        const product = products[0];
        console.log('[AI-Test] Testing with real product:', product.id, product.title);

        // 调用审核
        const auditResult = await auditProduct({
            title: product.title,
            description: product.description || '',
            category: product.category || 'other'
        });

        if (!auditResult) {
            return res.json({
                success: false,
                stage: 'audit',
                product: { id: product.id, title: product.title },
                error: 'auditProduct returned null'
            });
        }

        // 尝试更新产品
        const updateData: any = {
            status: 'active',
            review_note: `[AI-Test] isSafe=${auditResult.isSafe}, confidence=${auditResult.confidence}`
        };

        const { error: updateError } = await sb
            .from('products')
            .update(updateData)
            .eq('id', product.id);

        if (updateError) {
            return res.json({
                success: false,
                stage: 'update',
                product: { id: product.id, title: product.title },
                auditResult,
                updateData,
                error: updateError.message,
                hint: updateError.hint,
                code: updateError.code
            });
        }

        res.json({
            success: true,
            product: { id: product.id, title: product.title },
            auditResult,
            updateData,
            message: 'Product updated successfully!'
        });

    } catch (err: any) {
        res.status(500).json({
            success: false,
            stage: 'exception',
            error: err.message,
            stack: err.stack?.split('\n').slice(0, 5)
        });
    }
});

/**
 * 自动商品审核定时任务
 * 每小时执行一次，自动审核新上架的商品
 * 由 Vercel Cron 触发
 */
app.post('/api/cron/auto-review', async (req: any, res) => {
    try {
        // 验证请求来源 - 支持 Vercel Cron header 或 CRON_SECRET
        const authHeader = req.headers.authorization;
        const vercelCron = req.headers['x-vercel-cron'];
        const cronSecret = process.env.CRON_SECRET;

        // Vercel Cron 请求会带有 x-vercel-cron header
        const isVercelCron = vercelCron === '1';

        // 或者通过 Bearer token 验证
        const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isVercelCron && !isAuthorized) {
            console.warn('[Cron] Unauthorized access attempt to auto-review');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('[Cron] Starting auto-review job...');

        // 执行自动审核，处理过去24小时内创建的待审核商品
        const stats = await autoReviewPendingProducts(50);

        console.log('[Cron] Auto-review completed:', stats);

        res.json({
            success: true,
            message: 'Auto-review completed',
            stats,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Cron] Auto-review failed:', error);
        res.status(500).json({
            error: 'Auto-review failed',
            message: error.message
        });
    }
});

// 也支持 GET 方法 (Vercel Cron 默认使用 GET)
app.get('/api/cron/auto-review', async (req: any, res) => {
    // 复用 POST 逻辑
    try {
        const vercelCron = req.headers['x-vercel-cron'];
        const cronSecret = process.env.CRON_SECRET;
        const authHeader = req.headers.authorization;

        const isVercelCron = vercelCron === '1';
        const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isVercelCron && !isAuthorized) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('[Cron] Starting auto-review job (GET)...');
        const stats = await autoReviewPendingProducts(50);

        res.json({
            success: true,
            message: 'Auto-review completed',
            stats,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Cron] Auto-review failed:', error);
        res.status(500).json({ error: 'Auto-review failed', message: error.message });
    }
});

// 批量翻译现有产品 (管理员可调用)
app.post('/api/admin/batch-translate', requireAdmin, batchTranslateProducts);
// ==================================================================
// PAYOUT MANAGEMENT (Manual Bank Transfer)
// ==================================================================

// Get all orders pending payout (admin)
app.get('/api/admin/payouts', requireAdmin, async (req: any, res) => {
    try {
        const status = req.query.status || 'pending';

        // 构建基础查询
        let query = supabase
            .from('orders')
            .select(`
                id,
                total_amount,
                platform_fee,
                status,
                payout_status,
                payout_at,
                payout_reference,
                created_at,
                completed_at,
                seller_id,
                buyer_id,
                products:product_id(id, title, images),
                seller:seller_id(
                    id,
                    name,
                    email,
                    sellers(bank_clabe, bank_name, bank_holder_name)
                )
            `)
            .in('status', ['completed', 'delivered']);

        // 根据状态筛选 - 修复NULL值匹配问题
        if (status === 'pending') {
            // pending包括NULL和'pending'两种情况
            query = query.or('payout_status.is.null,payout_status.eq.pending');
        } else if (status !== 'all') {
            query = query.eq('payout_status', status);
        }
        // status === 'all' 时不添加任何payout_status过滤

        const { data: orders, error } = await query.order('completed_at', { ascending: true });

        if (error) throw error;

        // Calculate payout amounts (total - platform fee)
        const payouts = (orders || []).map((order: any) => ({
            ...order,
            payoutAmount: order.total_amount - (order.platform_fee || order.total_amount * 0.05),
            sellerBank: order.seller?.sellers?.[0] || null
        }));

        // Get summary stats
        const stats = {
            pending: payouts.filter(p => p.payout_status === 'pending' || !p.payout_status).length,
            processing: payouts.filter(p => p.payout_status === 'processing').length,
            completed: payouts.filter(p => p.payout_status === 'completed').length,
            totalPendingAmount: payouts
                .filter(p => p.payout_status === 'pending' || !p.payout_status)
                .reduce((sum, p) => sum + p.payoutAmount, 0)
        };

        res.json({ payouts, stats });
    } catch (error: any) {
        console.error('Get payouts error:', error);
        res.status(500).json({ error: 'Failed to get payouts', message: error.message });
    }
});


// Mark order as paid out (admin)
app.post('/api/admin/payouts/:orderId/complete', requireAdmin, async (req: any, res) => {
    try {
        const { orderId } = req.params;
        const { reference, notes } = req.body;
        const adminId = req.admin?.id;

        // Update order payout status
        const { data: order, error } = await supabase
            .from('orders')
            .update({
                payout_status: 'completed',
                payout_at: new Date().toISOString(),
                payout_reference: reference || `MANUAL-${Date.now()}`
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;

        // Add to order timeline
        await supabase.from('order_timeline').insert({
            order_id: orderId,
            event_type: 'payout_completed',
            description: `Payout completed via bank transfer${reference ? `: ${reference}` : ''}`,
            created_by: adminId,
            metadata: { reference, notes }
        });

        console.log('[Payout] Marked as completed:', orderId, 'reference:', reference);

        res.json({ success: true, order });
    } catch (error: any) {
        console.error('Complete payout error:', error);
        res.status(500).json({ error: 'Failed to complete payout', message: error.message });
    }
});

// Mark order payout as processing (admin)
app.post('/api/admin/payouts/:orderId/processing', requireAdmin, async (req: any, res) => {
    try {
        const { orderId } = req.params;

        const { data: order, error } = await supabase
            .from('orders')
            .update({ payout_status: 'processing' })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, order });
    } catch (error: any) {
        console.error('Processing payout error:', error);
        res.status(500).json({ error: 'Failed to update payout', message: error.message });
    }
});

// Get seller's payout history (user)
app.get('/api/users/payouts', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: payouts, error } = await supabase
            .from('orders')
            .select(`
                id,
                total_amount,
                platform_fee,
                payout_status,
                payout_at,
                payout_reference,
                completed_at,
                products:product_id(id, title, images)
            `)
            .eq('seller_id', userId)
            .in('status', ['completed', 'delivered'])
            .order('completed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Calculate payout amounts
        const result = (payouts || []).map(p => ({
            ...p,
            payoutAmount: p.total_amount - (p.platform_fee || p.total_amount * 0.05),
            status: p.payout_status || 'pending'
        }));

        // Get summary
        const summary = {
            totalEarned: result.reduce((sum, p) => sum + p.payoutAmount, 0),
            pending: result.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.payoutAmount, 0),
            completed: result.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.payoutAmount, 0)
        };

        res.json({ payouts: result, summary });
    } catch (error: any) {
        console.error('Get user payouts error:', error);
        res.status(500).json({ error: 'Failed to get payouts', message: error.message });
    }
});


// SEO & Location
app.get('/sitemap.xml', generateSitemap);
app.get('/llms-full.txt', generateLlmsFull);
app.get('/api/location/reverse', reverseGeocodeProxy);

// New IP Location Proxy
app.get('/api/location/ip', async (req, res) => {
    try {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;

        // If localhost, return dummy data
        if (!ip || ip === '::1' || ip === '127.0.0.1') {
            return res.json({ country: 'MX', city: 'Mexico City', countryName: 'Mexico' });
        }

        const fetchRes = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!fetchRes.ok) throw new Error('IP API failed');

        const data = await fetchRes.json();
        res.json({
            country: data.country_code || 'MX',
            city: data.city || 'Unknown',
            countryName: data.country_name || 'Mexico'
        });
    } catch (e: any) {
        console.error('IP Location Error:', e.message);
        // Fallback to MX default instead of erroring 500
        res.json({ country: 'MX', city: 'Mexico City', countryName: 'Mexico' });
    }
});

// Update user location
app.post('/api/users/update-location', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { country, city, countryName, lat, lng } = req.body;

        console.log('[UpdateLocation] Updating location for user:', userId, { country, city });

        const { error } = await supabase
            .from('users')
            .update({
                location_country: country,
                location_city: city,
                location_lat: lat || null,
                location_lng: lng || null,
                location_updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error('[UpdateLocation] Error:', error);
            throw error;
        }

        res.json({
            success: true,
            location: { country, city, countryName }
        });
    } catch (error: any) {
        console.error('Update location error:', error);
        res.status(500).json({
            error: 'Failed to update location',
            message: error.message
        });
    }
});


// Save seller bank info (simplified - no Stripe Connect)
app.post('/api/users/bank-info', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { bankName, clabe, holderName } = req.body;

        // Validate CLABE (18 digits)
        if (!clabe || clabe.length !== 18 || !/^\d+$/.test(clabe)) {
            return res.status(400).json({ error: 'CLABE must be 18 digits' });
        }

        if (!holderName || !bankName) {
            return res.status(400).json({ error: 'Bank name and holder name are required' });
        }

        console.log('[BankInfo] Saving bank info for user:', userId);

        // Upsert into sellers table
        const { error } = await supabase
            .from('sellers')
            .upsert({
                user_id: userId,
                bank_clabe: clabe,
                bank_name: bankName,
                bank_holder_name: holderName,
                bank_info_updated_at: new Date().toISOString(),
                onboarding_complete: true
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('[BankInfo] Error:', error);
            throw error;
        }

        res.json({
            success: true,
            message: 'Bank info saved successfully'
        });
    } catch (error: any) {
        console.error('Save bank info error:', error);
        res.status(500).json({
            error: 'Failed to save bank info',
            message: error.message
        });
    }
});


// Rating & Reviews
import { submitRating, getUserRatingStats } from './_lib/controllers/ratingController.js';
app.post('/api/ratings', requireAuth, submitRating);
app.get('/api/ratings/:userId/stats', getUserRatingStats);

// ------------------------------------------------------------------
// PRICE NEGOTIATION ENDPOINTS
// ------------------------------------------------------------------

// 发起议价
app.post('/api/negotiations/propose', requireAuth, async (req: any, res) => {
    try {
        const { conversationId, productId, proposedPrice } = req.body;
        const userId = req.user.id;

        console.log('[Negotiation API] Received request:', { conversationId, productId, proposedPrice, userId });

        // 验证参数
        if (!conversationId || !productId || !proposedPrice) {
            console.error('[Negotiation API] Missing fields');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 获取对话信息
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            .single();

        console.log('[Negotiation API] Conversation query result:', { conversation, convError });

        if (convError || !conversation) {
            console.error('[Negotiation API] Conversation not found:', convError);
            return res.status(404).json({ error: 'Conversation not found', details: convError?.message });
        }

        // 获取产品信息
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        console.log('[Negotiation API] Product query result:', { product, productError });

        if (productError || !product) {
            console.error('[Negotiation API] Product not found:', productError);
            return res.status(404).json({ error: 'Product not found', details: productError?.message });
        }

        // 确定买家和卖家
        // conversations表使用user1_id和user2_id，需要根据product.seller_id判断
        const sellerId = product.seller_id;
        const buyerId = conversation.user1_id === sellerId ? conversation.user2_id : conversation.user1_id;
        const actualSellerId = conversation.user1_id === sellerId ? conversation.user1_id : conversation.user2_id;

        console.log('[Negotiation API] Identity check:', {
            currentUserId: userId,
            productSellerId: sellerId,
            conversationUser1: conversation.user1_id,
            conversationUser2: conversation.user2_id,
            determinedBuyerId: buyerId,
            determinedSellerId: actualSellerId,
            isBuyer: buyerId === userId,
            isSeller: actualSellerId === userId
        });

        // 验证用户身份（只有买家可以发起议价）
        if (buyerId !== userId) {
            console.error('[Negotiation API] User not buyer:', {
                buyerId,
                sellerId: actualSellerId,
                userId
            });
            return res.status(403).json({
                error: 'Only buyer can propose price',
                debug: {
                    yourRole: actualSellerId === userId ? 'seller' : 'unknown',
                    requiredRole: 'buyer',
                    yourUserId: userId,
                    conversationUser1Id: conversation.user1_id,
                    conversationUser2Id: conversation.user2_id,
                    productSellerId: sellerId,
                    determinedBuyerId: buyerId,
                    conversationId
                }
            });
        }

        // 创建议价记录
        const { data: negotiation, error: negError } = await supabase
            .from('price_negotiations')
            .insert({
                conversation_id: conversationId,
                product_id: productId,
                buyer_id: buyerId,          // 买家ID
                seller_id: actualSellerId,  // 卖家ID
                original_price: product.price,
                offered_price: parseFloat(proposedPrice),
                proposed_by: userId,
                status: 'pending'
            })
            .select()
            .single();

        console.log('[Negotiation API] Created negotiation:', { negotiation, negError });

        if (negError) {
            console.error('[Negotiation API] Failed to create negotiation:', negError);
            throw negError;
        }

        // 发送议价卡片消息
        const messageResult = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: userId,
            text: `💰 议价请求: $${proposedPrice} (原价: $${product.price})`,
            message_type: 'price_negotiation',
            content: JSON.stringify({
                negotiationId: negotiation.id,
                originalPrice: product.price,
                proposedPrice: parseFloat(proposedPrice),
                productTitle: product.title,
                status: 'pending'
            }),
            is_pinned: true,
            pinned_until: new Date(Date.now() + 48 * 60 * 60 * 1000) // 置顶48小时
        });

        console.log('[Negotiation API] Message insert result:', messageResult);

        if (messageResult.error) {
            console.error('Failed to insert negotiation message:', messageResult.error);
        }

        console.log('[Negotiation API] Success! Returning negotiation:', negotiation.id);
        res.json({ negotiation });
    } catch (error: any) {
        console.error('Propose negotiation error:', error);
        res.status(500).json({ error: 'Failed to propose price', message: error.message });
    }
});

// 响应议价
app.post('/api/negotiations/:id/respond', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { action, counterPrice } = req.body;
        const userId = req.user.id;

        // 验证action
        if (!['accept', 'reject', 'counter'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // 获取议价记录 (简化查询，避免关联语法问题)
        const { data: negotiation, error: negError } = await supabase
            .from('price_negotiations')
            .select('*')
            .eq('id', id)
            .single();

        console.log('[Negotiation Response] Query result:', { negotiation, negError });

        if (negError || !negotiation) {
            console.error('[Negotiation Response] Not found:', negError);
            return res.status(404).json({ error: 'Negotiation not found', details: negError?.message });
        }

        // 单独获取产品信息
        const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', negotiation.product_id)
            .single();

        console.log('[Negotiation Response] Found negotiation:', {
            id: negotiation.id,
            seller_id: negotiation.seller_id,
            buyer_id: negotiation.buyer_id,
            offered_price: negotiation.offered_price,
            status: negotiation.status
        });

        // 验证卖家身份 - 使用 negotiation.seller_id
        if (negotiation.seller_id !== userId) {
            console.error('[Negotiation Response] Not seller:', { expected: negotiation.seller_id, actual: userId });
            return res.status(403).json({ error: 'Only seller can respond' });
        }

        // 验证状态
        if (negotiation.status !== 'pending') {
            return res.status(400).json({ error: 'Negotiation already processed' });
        }

        let updateData: any = {
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        let messageContent: any = {
            negotiationId: id,
            originalPrice: negotiation.original_price,
            proposedPrice: negotiation.offered_price,
            productTitle: product?.title || 'Unknown Product'
        };

        // 处理不同响应
        switch (action) {
            case 'accept':
                updateData.status = 'accepted';
                messageContent.status = 'accepted';
                messageContent.finalPrice = negotiation.proposed_price;

                // 更新产品价格
                await supabase
                    .from('products')
                    .update({ price: negotiation.offered_price })
                    .eq('id', negotiation.product_id);

                break;

            case 'reject':
                updateData.status = 'rejected';
                messageContent.status = 'rejected';
                break;

            case 'counter':
                if (!counterPrice) {
                    return res.status(400).json({ error: 'Counter price required' });
                }
                updateData.status = 'countered';
                updateData.counter_price = parseFloat(counterPrice);
                messageContent.status = 'countered';
                messageContent.counterPrice = parseFloat(counterPrice);
                break;
        }

        // 更新议价记录
        await supabase
            .from('price_negotiations')
            .update(updateData)
            .eq('id', id);

        // 生成响应消息文本
        let responseText = '';
        switch (action) {
            case 'accept':
                responseText = `✅ 卖家已接受议价 $${negotiation.offered_price}`;
                break;
            case 'reject':
                responseText = `❌ 卖家拒绝了议价`;
                break;
            case 'counter':
                responseText = `💬 卖家还价 $${counterPrice}`;
                break;
        }

        // 发送响应消息
        const msgResult = await supabase.from('messages').insert({
            conversation_id: negotiation.conversation_id,
            sender_id: userId,
            text: responseText,
            message_type: 'price_negotiation_response',
            content: JSON.stringify(messageContent),
            is_pinned: true,
            pinned_until: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        console.log('[Negotiation Response] Message insert result:', msgResult);

        // 更新原始议价消息的 content.status
        const { data: originalMsg, error: findError } = await supabase
            .from('messages')
            .select('id, content')
            .eq('conversation_id', negotiation.conversation_id)
            .eq('message_type', 'price_negotiation')
            .ilike('content', `%${id}%`)
            .single();

        if (originalMsg && !findError) {
            try {
                const updatedContent = JSON.parse(originalMsg.content);
                updatedContent.status = action === 'accept' ? 'accepted' : (action === 'reject' ? 'rejected' : 'countered');
                if (action === 'counter') updatedContent.counterPrice = parseFloat(counterPrice);
                if (action === 'accept') updatedContent.finalPrice = negotiation.offered_price;

                await supabase
                    .from('messages')
                    .update({ content: JSON.stringify(updatedContent) })
                    .eq('id', originalMsg.id);

                console.log('[Negotiation Response] Updated original message status');
            } catch (parseError) {
                console.error('[Negotiation Response] Failed to update original message:', parseError);
            }
        } else {
            console.log('[Negotiation Response] Original message not found:', findError);
        }

        res.json({ success: true, action, negotiation: updateData });
    } catch (error: any) {
        console.error('Respond to negotiation error:', error);
        res.status(500).json({ error: 'Failed to respond', message: error.message });
    }
});

// 获取产品的议价历史
app.get('/api/negotiations/product/:productId', requireAuth, async (req: any, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const { data: negotiations, error } = await supabase
            .from('price_negotiations')
            .select('*, conversation:conversations(*)')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 只返回用户参与的议价
        const filtered = negotiations?.filter(n =>
            n.conversation.buyer_id === userId || n.conversation.seller_id === userId
        );

        res.json({ negotiations: filtered || [] });
    } catch (error: any) {
        console.error('Get negotiations error:', error);
        res.status(500).json({ error: 'Failed to get negotiations', message: error.message });
    }
});

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
        // 统一平台费率为5%，与 v2/checkout-session 和 confirmOrder 保持一致
        const platformFee = paymentMethod === 'online' ? (productAmount * 0.05) : 0;
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

        // 🔔 发送订单创建通知到聊天
        import('./_lib/services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(order.id, 'created').catch((err: any) => {
                console.error('[CreateOrder] Failed to send notification:', err);
            });
        }).catch(console.error);

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
        res.json({ orders: orders || [] });
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

        // 🔔 发送确认通知
        import('./_lib/services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(id, isBuyer ? 'buyer_confirmed' : 'seller_confirmed', { confirmedBy: isBuyer ? 'buyer' : 'seller' }).catch(console.error);
        }).catch(console.error);

        if (updatedOrder.buyer_confirmed_at && updatedOrder.seller_confirmed_at) {
            const { data: completedOrder } = await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id).select().single();
            await supabase.from('order_timeline').insert({ order_id: id, event_type: 'completed', description: 'Order Completed', created_by: userId });

            // 🔔 发送完成通知
            import('./_lib/services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
                notifyOrderStatus(id, 'completed').catch(console.error);
            }).catch(console.error);

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

        // 🔔 发送见面安排通知
        import('./_lib/services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(id, 'meetup_arranged', { location, time }).catch(console.error);
        }).catch(console.error);
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
    apiVersion: '2024-12-18.acacia' as any, // Unified API version
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
app.post('/api/stripe/v2/create-account', requireAuth, async (req: any, res) => {
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
            const account = await stripe.accounts.create({
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
        const accountLink = await stripe.accountLinks.create({
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
app.get('/api/stripe/v2/account-status', requireAuth, async (req: any, res) => {
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
        const account = await stripe.accounts.retrieve(seller.stripe_connect_id);

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
app.post('/api/stripe/v2/account-link', requireAuth, async (req: any, res) => {
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
        const accountLink = await stripe.accountLinks.create({
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
app.get('/api/stripe/v2/dashboard-link', requireAuth, async (req: any, res) => {
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

        const loginLink = await stripe.accounts.createLoginLink(seller.stripe_connect_id);

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
app.post('/api/stripe/v2/checkout-session', requireAuth, async (req: any, res) => {
    try {
        const { orderId, productId, quantity = 1 } = req.body;
        const userId = req.user.id;

        // Get order details
        const { data: order } = await supabase
            .from('orders')
            .select('*, products(*), seller:seller_id(stripe_connect_id)')
            .eq('id', orderId)
            .single();

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
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

        // Calculate amounts
        const productPrice = order.products?.price || order.total_amount;
        const amountInCents = Math.round(productPrice * 100);

        // Platform fee: 5% - will be deducted when transferring to seller
        const platformFeePercent = 0.05;
        const platformFeeAmount = Math.round(amountInCents * platformFeePercent);

        const baseUrl = process.env.VITE_API_URL || 'https://www.descu.ai';

        // Create Checkout Session - Escrow Pattern (Separate Charges and Transfers)
        // Funds stay in platform account, NOT immediately transferred to seller
        // 卖家可能有Stripe Connect或只有银行卡(CLABE)，两种情况都支持
        const sellerStripeId = seller?.stripe_connect_id || '';
        const sellerPayoutMethod = hasStripeConnect ? 'stripe_connect' : 'manual_spei';

        const session = await stripe.checkout.sessions.create({
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
                    quantity: quantity,
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
        await supabase.from('orders').update({
            stripe_checkout_session_id: session.id,
            status: 'pending_payment',
            platform_fee: platformFeeAmount / 100,  // Store in decimal
            escrow_status: 'pending'
        }).eq('id', orderId);

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
app.post('/api/stripe/v2/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[StripeV2 Webhook] No webhook secret configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
                        import('./_lib/services/orderNotificationService.js').then(({ notifyOrderStatus }) => {
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
app.get('/api/stripe/seller-balance', requireAuth, async (req: any, res) => {
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
        const balance = await stripe.balance.retrieve({
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
app.post('/api/stripe/seller-payout', requireAuth, async (req: any, res) => {
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
        const balance = await stripe.balance.retrieve({
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
        const payout = await stripe.payouts.create({
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
app.get('/api/stripe/seller-payouts', requireAuth, async (req: any, res) => {
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
        const payouts = await stripe.payouts.list({
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
app.post('/api/stripe/create-express-account', requireAuth, async (req: any, res) => {
    // Redirect to V2 endpoint
    req.url = '/api/stripe/v2/create-account';
    return res.redirect(307, '/api/stripe/v2/create-account');
});

app.get('/api/stripe/express-status', requireAuth, async (req: any, res) => {
    // Forward to V2 endpoint
    req.url = '/api/stripe/v2/account-status';
    return res.redirect(307, '/api/stripe/v2/account-status');
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
// Force rebuild Sat Jan 17 21:14:34 CST 2026
