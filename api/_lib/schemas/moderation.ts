import { z } from 'zod';

/** Client-input schemas for /api/reports and /api/blocks (moderationController.ts). */

export const REPORT_TARGET_TYPES = ['user', 'product', 'message', 'conversation'] as const;
export const REPORT_REASONS = ['misinfo', 'hate', 'scam', 'prohibited', 'sensitive', 'harassment', 'spam', 'other'] as const;
export const REPORT_MAX_DESCRIPTION_LENGTH = 2000;

export type ReportTargetType = typeof REPORT_TARGET_TYPES[number];

/** Self-reports are rejected in the handler (needs the caller id). */
export const CreateReportSchema = z.object({
    target_type: z.enum(REPORT_TARGET_TYPES),
    target_id: z.string().uuid(),
    reason: z.enum(REPORT_REASONS),
    description: z.string().max(REPORT_MAX_DESCRIPTION_LENGTH, `description must be a string of at most ${REPORT_MAX_DESCRIPTION_LENGTH} characters`).optional(),
});
export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export const BlockUserSchema = z.object({ blocked_id: z.string().uuid() });

export const BlockedUserIdParamSchema = z.object({ userId: z.string().uuid() });
