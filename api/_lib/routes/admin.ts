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
    batchUpdateSettings,
    logAdminAction
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
import { listPayouts, completeManualPayout, markOrderPayoutProcessing } from '../services/payoutService.js';

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

// 管理员向某个对话发送系统消息（管理员不是对话参与者，所以不能走 /api/messages）
router.post('/api/admin/conversations/:id/messages', requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body ?? {};
        if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text is required' });
        if (text.length > 4000) return res.status(400).json({ error: 'Message too long' });

        const { data: conversation, error: convError } = await supabase
            .from('conversations').select('id').eq('id', id).maybeSingle();
        if (convError) throw convError;
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const { data: message, error } = await supabase
            .from('messages')
            .insert([{ conversation_id: id, sender_id: req.admin.id, text: text.trim() }])
            .select()
            .single();
        if (error) throw error;
        await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);
        res.status(201).json(message);
    } catch (error: any) {
        console.error('[Admin] send system message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// 批量翻译现有产品 (管理员可调用)
router.post('/api/admin/batch-translate', requireAdmin, batchTranslateProducts);

// ==================================================================
// PAYOUT MANAGEMENT (Manual Bank Transfer)
// All queue/state logic lives in services/payoutService.ts — the same path that
// POST /api/admin/orders/:id/mark-paid uses.
// ==================================================================

// Get the manual payout queue (admin): ?status=pending|processing|completed|all
router.get('/api/admin/payouts', requireAdmin, async (req: any, res) => {
    try {
        const { payouts, stats } = await listPayouts(req.query.status || 'pending');
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
        const { reference, notes } = req.body ?? {};

        const outcome = await completeManualPayout({ orderId, adminId: req.admin?.id ?? null, reference, notes });
        if (!outcome.ok) return res.status(outcome.code).json({ error: outcome.error });

        if (req.admin) {
            await logAdminAction(
                req.admin.id, req.admin.email, 'manual_payout', 'order', String(orderId),
                { reference: outcome.order.payout_reference, notes, previous_status: 'completed_pending_payout' },
                req.ip, req.get('user-agent')
            );
        }

        res.json({ success: true, order: outcome.order });
    } catch (error: any) {
        console.error('Complete payout error:', error);
        res.status(500).json({ error: 'Failed to complete payout', message: error.message });
    }
});

// Mark order payout as processing (admin)
router.post('/api/admin/payouts/:orderId/processing', requireAdmin, async (req: any, res) => {
    try {
        const { orderId } = req.params;
        const outcome = await markOrderPayoutProcessing(orderId);
        if (!outcome.ok) return res.status(outcome.code).json({ error: outcome.error });
        res.json({ success: true, order: outcome.order });
    } catch (error: any) {
        console.error('Processing payout error:', error);
        res.status(500).json({ error: 'Failed to update payout', message: error.message });
    }
});
