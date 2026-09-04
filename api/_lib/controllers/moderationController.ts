import { supabase } from '../db/supabase.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { listBlockedIds } from '../services/moderationService.js';
import { HttpError, asyncHandler, badRequest, notFound, parseBody, parseParams } from '../lib/http.js';
import {
    BlockUserSchema,
    BlockedUserIdParamSchema,
    CreateReportSchema,
    REPORT_REASONS,
    REPORT_TARGET_TYPES,
} from '../schemas/moderation.js';

/**
 * Reports & blocks (the "Report user" / "Block user" actions in chat and product pages).
 * Rows are written with the service-role client, so ownership is enforced here.
 * Input shapes live in schemas/moderation.ts.
 */

export { REPORT_REASONS, REPORT_TARGET_TYPES };

const isMissingTable = (error: unknown) => (error as { code?: string } | null)?.code === '42P01';
const isForeignKeyViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23503';

// POST /api/reports  { target_type, target_id, reason, description? }
export const createReport = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const reporterId = req.user!.id;
    const { target_type: type, target_id, reason, description } = parseBody(CreateReportSchema, req.body);
    if (type === 'user' && target_id === reporterId) throw badRequest('You cannot report yourself');

    try {
        // One open report per (reporter, target); re-submitting just acknowledges the existing one.
        const { data: existing, error: existingError } = await supabase
            .from('reports')
            .select('id, status')
            .eq('reporter_id', reporterId)
            .eq('target_type', type)
            .eq('target_id', target_id)
            .in('status', ['open', 'pending', 'reviewing'])
            .maybeSingle();
        if (existingError) throw existingError;
        if (existing) return res.json({ id: existing.id, status: existing.status, duplicate: true });

        const { data: report, error } = await supabase
            .from('reports')
            .insert({
                reporter_id: reporterId,
                target_type: type,
                target_id,
                reason,
                description: typeof description === 'string' ? description.trim() || null : null,
                status: 'open',
            })
            .select('id, status')
            .single();
        if (error) throw error;

        if (type === 'product') {
            // Surface heavily-reported listings in the admin review queue.
            const { data: product } = await supabase.from('products').select('reported_count').eq('id', target_id).maybeSingle();
            if (product) {
                await supabase.from('products')
                    .update({ reported_count: (Number(product.reported_count) || 0) + 1 })
                    .eq('id', target_id);
            }
        }

        res.status(201).json({ id: report.id, status: report.status, duplicate: false });
    } catch (error) {
        // The reports table ships in a later migration; until it exists the feature is "down", not broken.
        if (isMissingTable(error)) throw new HttpError(503, 'Reporting is temporarily unavailable');
        throw error;
    }
});

// POST /api/blocks  { blocked_id }
export const blockUser = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const blockerId = req.user!.id;
    const { blocked_id } = parseBody(BlockUserSchema, req.body);
    if (blocked_id === blockerId) throw badRequest('You cannot block yourself');

    const { error } = await supabase
        .from('blocks')
        .upsert({ blocker_id: blockerId, blocked_id }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
    if (error) {
        if (isMissingTable(error)) throw new HttpError(503, 'Blocking is temporarily unavailable');
        if (isForeignKeyViolation(error)) throw notFound('User not found');
        throw error;
    }

    res.status(201).json({ success: true, blocked_id });
});

// DELETE /api/blocks/:userId
export const unblockUser = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const blockerId = req.user!.id;
    const { userId: blockedId } = parseParams(BlockedUserIdParamSchema, req.params);

    const { error } = await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
    if (error) throw error;

    res.json({ success: true });
});

// GET /api/blocks → { blocked_ids: string[] }
export const getMyBlocks = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const blockedIds = await listBlockedIds(req.user!.id);
    res.json({ blocked_ids: blockedIds });
});
