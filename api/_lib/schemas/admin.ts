import { z } from 'zod';

/** Client-input schemas for the inline admin endpoints (payout queue, AI review, system messages). */

export const ConversationIdParamSchema = z.object({ id: z.string().uuid() });
export const OrderIdParamSchema = z.object({ orderId: z.string().uuid() });

export const PAYOUT_QUEUE_STATUSES = ['pending', 'processing', 'completed', 'all'] as const;

/** ?status= for GET /api/admin/payouts; anything unknown/missing falls back to the pending queue. */
export const ListPayoutsQuerySchema = z.object({
    status: z.enum(PAYOUT_QUEUE_STATUSES).catch('pending'),
});
export type ListPayoutsQuery = z.infer<typeof ListPayoutsQuerySchema>;

export const CompletePayoutSchema = z.object({
    reference: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
});
export type CompletePayoutInput = z.infer<typeof CompletePayoutSchema>;

export const AdminMessageSchema = z.object({
    text: z.string().trim().min(1, 'text is required').max(4000, 'Message too long'),
});
export type AdminMessageInput = z.infer<typeof AdminMessageSchema>;
