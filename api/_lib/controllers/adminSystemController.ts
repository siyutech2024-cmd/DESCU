import { supabase } from '../db/supabase.js';
import { HttpError, asyncHandler, notFound, parseBody, parseParams } from '../lib/http.js';
import type { AdminRequest } from '../middleware/adminAuth.js';
import { AdminMessageSchema, ConversationIdParamSchema } from '../schemas/admin.js';
import { autoReviewPendingProducts } from '../services/auditService.js';

/**
 * Admin system endpoints: manual AI review trigger, AI/cron configuration status,
 * and posting a system message into any conversation (admins are not participants,
 * so they cannot go through /api/messages).
 */

const AI_REVIEW_BATCH_SIZE = 50;

const isAiConfigured = () => !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

/** POST /api/admin/trigger-review — run one batch of the AI product review now. */
export const triggerAiReview = asyncHandler<AdminRequest>(async (req, res) => {
    if (!isAiConfigured()) {
        throw new HttpError(503, 'AI service not configured', { message: 'GEMINI_API_KEY environment variable is not set' });
    }

    console.log('[Admin] Manual AI review triggered by admin:', req.admin?.id);
    const stats = await autoReviewPendingProducts(AI_REVIEW_BATCH_SIZE);
    console.log('[Admin] Manual AI review completed:', stats);

    res.json({ success: true, message: 'AI review completed', stats, timestamp: new Date().toISOString() });
});

/** GET /api/admin/ai-status */
export const getAiStatus = asyncHandler<AdminRequest>(async (_req, res) => {
    const aiConfigured = isAiConfigured();
    const cronConfigured = !!process.env.CRON_SECRET;

    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review');
    if (error) throw error;

    res.json({
        aiConfigured,
        cronConfigured,
        pendingReviewCount: count || 0,
        message: aiConfigured
            ? 'AI service is configured and ready'
            : 'GEMINI_API_KEY is not configured - AI review will not work',
    });
});

/** POST /api/admin/conversations/:id/messages — admin posts a system message into a conversation. */
export const sendAdminMessage = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(ConversationIdParamSchema, req.params);
    const { text } = parseBody(AdminMessageSchema, req.body);

    const { data: conversation, error: convError } = await supabase
        .from('conversations').select('id').eq('id', id).maybeSingle();
    if (convError) throw convError;
    if (!conversation) throw notFound('Conversation not found');

    const { data: message, error } = await supabase
        .from('messages')
        .insert([{ conversation_id: id, sender_id: req.admin!.id, text }])
        .select()
        .single();
    if (error) throw error;

    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);

    res.status(201).json(message);
});
