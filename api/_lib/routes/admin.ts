import { Router } from 'express';
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
import { completePayout, getPayoutQueue, markPayoutProcessing } from '../controllers/adminPayoutController.js';
import { getAiStatus, sendAdminMessage, triggerAiReview } from '../controllers/adminSystemController.js';
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

// Admin System (AI review + diagnostics)
router.post('/api/admin/trigger-review', requireAdmin, triggerAiReview);
router.get('/api/admin/ai-status', requireAdmin, getAiStatus);
router.post('/api/admin/batch-translate', requireAdmin, batchTranslateProducts);

// Admin posts a system message into a conversation (admins are not participants, so not via /api/messages)
router.post('/api/admin/conversations/:id/messages', requireAdmin, sendAdminMessage);

// Payout Management (manual bank transfer) — queue/state logic lives in services/payoutService.ts,
// the same path POST /api/admin/orders/:id/mark-paid uses.
router.get('/api/admin/payouts', requireAdmin, getPayoutQueue);
router.post('/api/admin/payouts/:orderId/complete', requireAdmin, completePayout);
router.post('/api/admin/payouts/:orderId/processing', requireAdmin, markPayoutProcessing);
