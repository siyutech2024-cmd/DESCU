import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAdmin } from '../middleware/adminAuth.js';
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
} from '../controllers/adminController.js';
import {
    getAdminProducts,
    getAdminProduct,
    updateAdminProduct,
    deleteAdminProduct,
    restoreAdminProduct,
    updateProductStatus,
    updateProductPromotion,
    batchUpdateProducts
} from '../controllers/adminProductController.js';
import {
    getAdminUsers,
    getAdminUser,
    updateUserVerification,
    deleteAdminUser
} from '../controllers/adminUserController.js';
import {
    getAdminConversations,
    getAdminConversation,
    deleteAdminConversation,
    deleteAdminMessage,
    flagAdminMessage
} from '../controllers/adminMessageController.js';
import { autoReviewPendingProducts } from '../services/auditService.js';
import { batchTranslateProducts } from '../services/batchTranslateService.js';

/**
 * Admin routes — everything under /api/admin/*.
 * All routes require an authenticated admin (see middleware/adminAuth) except the
 * explicitly dev-mode-gated diagnostic endpoints.
 */
export const adminRouter = Router();
const router = adminRouter;

// Admin Endpoints
router.get('/api/admin/dashboard/stats', requireAdmin, getDashboardStats);
router.get('/api/admin/auth/me', requireAdmin, getAdminInfo);
router.get('/api/admin/logs', requireAdmin, getAdminLogs);
router.get('/api/admin/orders', requireAdmin, getAdminOrders);
router.post('/api/admin/orders/:id/mark-paid', requireAdmin, markOrderAsPaid);
router.get('/api/admin/disputes', requireAdmin, getAdminDisputes);
router.post('/api/admin/disputes/resolve', requireAdmin, resolveDispute);

// Admin Product Management
router.get('/api/admin/products', requireAdmin, getAdminProducts);
router.get('/api/admin/products/:id', requireAdmin, getAdminProduct);
router.put('/api/admin/products/:id', requireAdmin, updateAdminProduct);
router.delete('/api/admin/products/:id', requireAdmin, deleteAdminProduct);
router.post('/api/admin/products/:id/restore', requireAdmin, restoreAdminProduct);
router.patch('/api/admin/products/:id/status', requireAdmin, updateProductStatus);
router.patch('/api/admin/products/:id/promote', requireAdmin, updateProductPromotion);
router.post('/api/admin/products/batch', requireAdmin, batchUpdateProducts);

// Admin User Management
router.get('/api/admin/users', requireAdmin, getAdminUsers);
router.get('/api/admin/users/:id', requireAdmin, getAdminUser);
router.patch('/api/admin/users/:id/verify', requireAdmin, updateUserVerification);
router.delete('/api/admin/users/:id', requireAdmin, deleteAdminUser);

// Admin Message Management
router.get('/api/admin/conversations', requireAdmin, getAdminConversations);
router.get('/api/admin/conversations/:id', requireAdmin, getAdminConversation);
router.delete('/api/admin/conversations/:id', requireAdmin, deleteAdminConversation);
router.delete('/api/admin/messages/:id', requireAdmin, deleteAdminMessage);
router.patch('/api/admin/messages/:id/flag', requireAdmin, flagAdminMessage);

// Admin Reports and Settings
router.get('/api/admin/reports', requireAdmin, getReportsData);
router.get('/api/admin/settings', requireAdmin, getSystemSettings);
router.put('/api/admin/settings', requireAdmin, updateSystemSettings);
router.post('/api/admin/settings/batch', requireAdmin, batchUpdateSettings);

// ==================================================================
// ADMIN MANUAL TRIGGER - 管理员手动触发
// ==================================================================

/**
 * 管理员手动触发AI审核（需管理员身份；不再支持任何 dev-mode 绕过）
 */
router.post('/api/admin/trigger-review', requireAdmin, (req: any, res) => handleTriggerReview(req, res));

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
router.get('/api/admin/ai-status', requireAdmin, async (req: any, res) => {
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

// 批量翻译现有产品 (管理员可调用)
router.post('/api/admin/batch-translate', requireAdmin, batchTranslateProducts);

// ==================================================================
// PAYOUT MANAGEMENT (Manual Bank Transfer)
// ==================================================================

// Get all orders pending payout (admin)
router.get('/api/admin/payouts', requireAdmin, async (req: any, res) => {
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
            .in('status', ['completed', 'delivered'])
            // Only money the platform actually collected can be paid out
            .eq('payment_method', 'online')
            .eq('payment_captured', true);

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
router.post('/api/admin/payouts/:orderId/complete', requireAdmin, async (req: any, res) => {
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
router.post('/api/admin/payouts/:orderId/processing', requireAdmin, async (req: any, res) => {
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
