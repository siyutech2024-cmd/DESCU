import { z } from 'zod';
import { adminPaginationFields } from './adminGeneral.js';

/** Client-input schemas for the admin conversation / message monitor (adminMessageController.ts). */

/** `last_message_time` is what the UI historically sent; it maps to `updated_at` in the handler. */
export const ADMIN_CONVERSATION_SORTS = ['updated_at', 'created_at', 'last_message_time'] as const;

export const AdminConversationsQuerySchema = z.object({
    ...adminPaginationFields(20),
    // Both ids are interpolated into PostgREST filters, so they must be well-formed UUIDs.
    product_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    include_deleted: z.string().max(10).default('false'),
    sort_by: z.enum(ADMIN_CONVERSATION_SORTS).catch('updated_at'),
    sort_order: z.enum(['asc', 'desc']).catch('desc'),
});
export type AdminConversationsQuery = z.infer<typeof AdminConversationsQuerySchema>;

export const FlagMessageSchema = z.object({
    is_flagged: z.boolean(),
    flag_reason: z.string().max(500).nullable().optional(),
});
