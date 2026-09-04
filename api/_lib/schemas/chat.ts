import { z } from 'zod';

/**
 * Client-input schemas for /api/conversations and /api/messages (chatController.ts).
 * Every id here ends up in a PostgREST filter string, so UUID validation is a security check.
 */

export const ConversationIdParamSchema = z.object({ conversationId: z.string().uuid() });

export const CreateConversationSchema = z.object({
    product_id: z.string().uuid(),
    user1_id: z.string().uuid(),
    user2_id: z.string().uuid(),
});
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;

/**
 * Only the conversation id is validated here; the message body itself (text / rich cards)
 * goes through domain/chatMessages.validateMessagePayload, which owns those rules.
 */
export const SendMessageSchema = z.object({ conversation_id: z.string().uuid() });

export const MESSAGES_DEFAULT_LIMIT = 50;
export const MESSAGES_MAX_LIMIT = 100;

/** Mirrors the historical `parseInt(...) || fallback` parsing so odd values degrade instead of failing. */
const legacyInt = (fallback: number, clamp: (n: number) => number) =>
    z.preprocess(v => clamp(parseInt(String(v), 10) || fallback), z.number().int());

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Query for GET /api/messages/:conversationId.
 *   default: ascending + offset paging
 *   `order=desc` + `before=<ISO timestamp>`: cursor paging used by the chat window ("load earlier").
 * `before` keeps the client's original string — Postgres stores microseconds and `new Date()`
 * would truncate to milliseconds, skipping rows that share the oldest millisecond.
 */
export const GetMessagesQuerySchema = z.object({
    limit: legacyInt(MESSAGES_DEFAULT_LIMIT, n => Math.min(Math.max(n, 1), MESSAGES_MAX_LIMIT)),
    offset: legacyInt(0, n => Math.max(n, 0)),
    order: z.enum(['asc', 'desc']).catch('asc'),
    before: z.preprocess(
        v => (typeof v === 'string' && v ? v : undefined),
        z.string()
            .regex(ISO_TIMESTAMP_RE, 'Invalid `before` cursor')
            .refine(s => !Number.isNaN(new Date(s).getTime()), 'Invalid `before` cursor')
            .optional(),
    ),
});
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
