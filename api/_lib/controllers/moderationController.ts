import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { isUuid } from './chatController.js';
import { listBlockedIds } from '../services/moderationService.js';

/**
 * Reports & blocks (the "Report user" / "Block user" actions in chat and product pages).
 * Rows are written with the service-role client, so ownership is enforced here.
 */

export const REPORT_TARGET_TYPES = ['user', 'product', 'message', 'conversation'] as const;
export const REPORT_REASONS = ['misinfo', 'hate', 'scam', 'prohibited', 'sensitive', 'harassment', 'spam', 'other'] as const;
const MAX_DESCRIPTION_LENGTH = 2000;

type ReportTargetType = typeof REPORT_TARGET_TYPES[number];

// POST /api/reports  { target_type, target_id, reason, description? }
export const createReport = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const reporterId = req.user!.id;
        const { target_type, target_id, reason, description } = req.body ?? {};

        if (!REPORT_TARGET_TYPES.includes(target_type)) return res.status(400).json({ error: 'Invalid target_type' });
        if (!isUuid(target_id)) return res.status(400).json({ error: 'Invalid target_id' });
        if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid reason' });
        if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
            return res.status(400).json({ error: `description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters` });
        }
        if (target_type === 'user' && target_id === reporterId) {
            return res.status(400).json({ error: 'You cannot report yourself' });
        }

        const type = target_type as ReportTargetType;

        // One open report per (reporter, target); re-submitting just acknowledges the existing one.
        const { data: existing, error: existingError } = await supabase
            .from('reports')
            .select('id, status')
            .eq('reporter_id', reporterId)
            .eq('target_type', type)
            .eq('target_id', target_id)
            .in('status', ['open', 'reviewing'])
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
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
};

// POST /api/blocks  { blocked_id }
export const blockUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const blockerId = req.user!.id;
        const { blocked_id } = req.body ?? {};
        if (!isUuid(blocked_id)) return res.status(400).json({ error: 'Invalid blocked_id' });
        if (blocked_id === blockerId) return res.status(400).json({ error: 'You cannot block yourself' });

        const { error } = await supabase
            .from('blocks')
            .upsert({ blocker_id: blockerId, blocked_id }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
        if (error) throw error;

        res.status(201).json({ success: true, blocked_id });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: 'Failed to block user' });
    }
};

// DELETE /api/blocks/:userId
export const unblockUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const blockerId = req.user!.id;
        const blockedId = req.params.userId;
        if (!isUuid(blockedId)) return res.status(400).json({ error: 'Invalid user id' });

        const { error } = await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
};

// GET /api/blocks → { blocked_ids: string[] }
export const getMyBlocks = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const blockedIds = await listBlockedIds(req.user!.id);
        res.json({ blocked_ids: blockedIds });
    } catch (error) {
        console.error('Error listing blocks:', error);
        res.status(500).json({ error: 'Failed to list blocks' });
    }
};
