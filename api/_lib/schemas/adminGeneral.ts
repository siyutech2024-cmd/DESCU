import { z } from 'zod';

/**
 * Client-input schemas for the admin dashboard endpoints in adminController.ts
 * (logs, orders, disputes, settings) plus the paging helper every admin list shares.
 */

export const ADMIN_MAX_LIMIT = 100;

/**
 * `page` / `limit` query fields. Garbage or missing values fall back to the defaults
 * (the previous `Number(x)` parsing produced NaN offsets); `limit` is capped.
 */
export const adminPaginationFields = (defaultLimit: number) => ({
    page: z.coerce.number().int().min(1).catch(1),
    limit: z.coerce.number().int().min(1).catch(defaultLimit).transform(n => Math.min(n, ADMIN_MAX_LIMIT)),
});

/** Optional free-text filter; empty strings are dropped (the admin UI never sends them, but be lenient). */
export const optionalFilter = (max = 200) =>
    z.preprocess(v => (v === '' || v === 'undefined' ? undefined : v), z.string().max(max).optional());

export const AdminIdParamSchema = z.object({ id: z.string().uuid() });

export const AdminLogsQuerySchema = z.object({
    ...adminPaginationFields(50),
    action_type: optionalFilter(100),
    target_type: optionalFilter(100),
    admin_id: z.string().uuid().optional(),
});

export const AdminOrdersQuerySchema = z.object({
    ...adminPaginationFields(20),
    status: optionalFilter(50),
});

/** GET /api/admin/disputes: `status` defaults to the open queue; `status=` (empty) means no filter. */
export const AdminDisputesQuerySchema = z.object({
    ...adminPaginationFields(20),
    status: z.string().max(50).default('open'),
});

export const DISPUTE_ACTIONS = ['refund', 'release'] as const;

export const ResolveDisputeSchema = z.object({
    disputeId: z.string().uuid(),
    action: z.enum(DISPUTE_ACTIONS),
    adminNote: z.string().max(2000).nullable().optional(),
});
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;

export const MarkOrderPaidSchema = z.object({
    notes: z.string().trim().max(1000).nullable().optional(),
    reference: z.string().trim().max(200).nullable().optional(),
});

export const REPORT_TIME_RANGES = ['24h', '7d', '30d', '90d'] as const;

export const ReportsQuerySchema = z.object({
    timeRange: z.enum(REPORT_TIME_RANGES).catch('7d'),
});

const settingFields = {
    setting_key: z.string().trim().min(1).max(100),
    // Stored as text; numbers / booleans from the UI are stringified by the handler.
    setting_value: z.union([z.string(), z.number(), z.boolean()]),
    description: z.string().max(500).nullable().optional(),
};

export const UpdateSettingSchema = z.object(settingFields);
export type UpdateSettingInput = z.infer<typeof UpdateSettingSchema>;

export const BatchUpdateSettingsSchema = z.object({
    settings: z.array(z.object(settingFields)).min(1).max(100),
});
