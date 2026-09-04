import { supabase } from '../db/supabase.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { isBlockedBetween } from '../services/moderationService.js';
import { imagePrefixesFromEnv, validateMessagePayload } from '../domain/chatMessages.js';
import { asyncHandler, badRequest, forbidden, notFound, parseBody, parseParams, parseQuery } from '../lib/http.js';
import {
    ConversationIdParamSchema,
    CreateConversationSchema,
    GetMessagesQuerySchema,
    SendMessageSchema,
} from '../schemas/chat.js';

/**
 * Chat controller.
 *
 * All handlers run behind `requireAuth` and use the service-role client, so RLS does
 * NOT protect these queries — every handler must verify that `req.user.id` is a
 * participant of the conversation it touches. Identifiers coming from the client are
 * validated as UUIDs (zod schemas) before being used in any filter (PostgREST `.or()`
 * filters are strings, so unvalidated input there is an injection vector).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

interface ConversationRow {
    id: string;
    product_id: string;
    user1_id: string;
    user2_id: string;
    updated_at: string;
    [key: string]: unknown;
}

interface LastMessage {
    text: string;
    sender_id: string;
    message_type: string;
    created_at: string;
    is_read: boolean;
}

export const isParticipant = (conversation: Pick<ConversationRow, 'user1_id' | 'user2_id'>, userId: string): boolean =>
    conversation.user1_id === userId || conversation.user2_id === userId;

/** Load a conversation (id already validated as a UUID) and assert the caller participates; throws 404/403. */
const loadOwnConversation = async (conversationId: string, userId: string): Promise<ConversationRow> => {
    const { data, error } = await supabase
        .from('conversations')
        .select('id, product_id, user1_id, user2_id, updated_at')
        .eq('id', conversationId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw notFound('Conversation not found');
    if (!isParticipant(data, userId)) throw forbidden('Not a participant of this conversation');
    return data as ConversationRow;
};

// 创建（或获取已存在的）对话 —— 调用者必须是双方之一
export const createConversation = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { product_id, user1_id, user2_id } = parseBody(CreateConversationSchema, req.body);

    if (user1_id === user2_id) throw badRequest('Cannot start a conversation with yourself');
    if (userId !== user1_id && userId !== user2_id) throw forbidden('You must be a participant of the conversation');

    const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, seller_id')
        .eq('id', product_id)
        .maybeSingle();
    if (productError) throw productError;
    if (!product) throw notFound('Product not found');

    const otherId = userId === user1_id ? user2_id : user1_id;
    if (product.seller_id !== userId && product.seller_id !== otherId) {
        throw badRequest('Conversation must include the product seller');
    }
    if (await isBlockedBetween(userId, otherId)) throw forbidden('You cannot message this user');

    // ids are validated UUIDs above, so interpolation into the filter is safe
    const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('*')
        .eq('product_id', product_id)
        .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`)
        .limit(1)
        .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return res.json(existing);

    const { data, error } = await supabase
        .from('conversations')
        .insert([{ product_id, user1_id, user2_id }])
        .select()
        .single();
    if (error) throw error;

    res.status(201).json(data);
});

interface LastMessageRow {
    conversation_id: string;
    text: string | null;
    sender_id: string;
    message_type: string | null;
    created_at: string;
    is_read: boolean | null;
}

/**
 * Exactly one (the newest) message per conversation via the `conversation_last_messages`
 * SQL function (DISTINCT ON). Before that migration exists we fall back to a bounded
 * newest-first scan, where a very chatty thread can push others out of the window.
 */
const loadLastMessages = async (conversationIds: string[]): Promise<{ data: LastMessageRow[] | null; error: { message: string; code?: string } | null }> => {
    const rpc = await supabase.rpc('conversation_last_messages', { p_conversation_ids: conversationIds });
    if (!rpc.error) return { data: (rpc.data ?? []) as LastMessageRow[], error: null };
    if (rpc.error.code !== '42883' && rpc.error.code !== 'PGRST202') return { data: null, error: rpc.error };

    const fallback = await supabase.from('messages')
        .select('conversation_id, text, sender_id, message_type, created_at, is_read')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(conversationIds.length * 25, 5000));
    return { data: (fallback.data ?? null) as LastMessageRow[] | null, error: fallback.error };
};

// 获取当前用户的所有对话（URL 中的 userId 必须等于登录用户）
export const getUserConversations = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    if (req.params.userId !== userId) throw forbidden('Cannot read another user\'s conversations');

    const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('updated_at', { ascending: false })
        .limit(200);
    if (error) throw error;

    const rows = (conversations ?? []) as ConversationRow[];
    if (rows.length === 0) return res.json([]);

    // Batch the lookups: one query for products, one for users (was 3 queries per conversation).
    const productIds = [...new Set(rows.map(c => c.product_id).filter(Boolean))];
    const userIds = [...new Set(rows.flatMap(c => [c.user1_id, c.user2_id]).filter(Boolean))];

    const conversationIds = rows.map(c => c.id);

    const [productsRes, usersRes, recentRes, unreadRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id, title, images, seller_id, seller_name, seller_avatar').in('id', productIds),
        supabase.from('users').select('id, name, avatar_url').in('id', userIds),
        loadLastMessages(conversationIds),
        // Unread = sent by the other party and not yet read.
        supabase.from('messages')
            .select('conversation_id')
            .in('conversation_id', conversationIds)
            .eq('is_read', false)
            .neq('sender_id', userId)
            .limit(5000),
        // The most recent order per (product, buyer) drives the order badge in the chat list.
        supabase.from('orders')
            .select('id, status, product_id, buyer_id, seller_id, created_at')
            .in('product_id', productIds)
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(500),
    ]);

    for (const r of [productsRes, usersRes, recentRes, unreadRes, ordersRes]) {
        if (r.error) throw r.error;
    }
    const products = productsRes.data, users = usersRes.data, recentMessages = recentRes.data, unreadRows = unreadRes.data, orders = ordersRes.data;

    const productById = new Map((products ?? []).map(p => [p.id, p]));
    const userById = new Map((users ?? []).map(u => [u.id, u]));
    const publicUser = (id: string) => {
        const u = userById.get(id);
        return { id, name: u?.name || id.slice(0, 8), avatar: u?.avatar_url ?? null };
    };

    const lastMessageByConversation = new Map<string, LastMessage>();
    for (const m of recentMessages ?? []) {
        if (!lastMessageByConversation.has(m.conversation_id)) {
            lastMessageByConversation.set(m.conversation_id, {
                text: m.text ?? '',
                sender_id: m.sender_id,
                message_type: m.message_type ?? 'text',
                created_at: m.created_at,
                is_read: !!m.is_read,
            });
        }
    }

    const unreadByConversation = new Map<string, number>();
    for (const m of unreadRows ?? []) {
        unreadByConversation.set(m.conversation_id, (unreadByConversation.get(m.conversation_id) ?? 0) + 1);
    }

    // key: `${product_id}:${buyer_id}` → newest order
    const orderByProductBuyer = new Map<string, { id: string; status: string }>();
    for (const o of orders ?? []) {
        const key = `${o.product_id}:${o.buyer_id}`;
        if (!orderByProductBuyer.has(key)) orderByProductBuyer.set(key, { id: o.id, status: o.status });
    }

    const result = rows.map(conversation => {
        const product = productById.get(conversation.product_id);
        const sellerId = product?.seller_id;
        const buyerId = sellerId && conversation.user2_id === sellerId ? conversation.user1_id
            : sellerId && conversation.user1_id === sellerId ? conversation.user2_id
            : conversation.user1_id;

        const sellerInfo = sellerId
            ? {
                id: sellerId,
                name: product?.seller_name || publicUser(sellerId).name,
                avatar: product?.seller_avatar || publicUser(sellerId).avatar,
            }
            : null;

        const order = orderByProductBuyer.get(`${conversation.product_id}:${buyerId}`) ?? null;

        return {
            ...conversation,
            productTitle: product?.title || '未知商品',
            productImage: product?.images?.[0] || '',
            sellerInfo,
            buyerInfo: publicUser(buyerId),
            buyer_id: buyerId,
            seller_id: sellerId ?? null,
            last_message: lastMessageByConversation.get(conversation.id) ?? null,
            unread_count: unreadByConversation.get(conversation.id) ?? 0,
            orderId: order?.id ?? null,
            orderStatus: order?.status ?? null,
        };
    });

    res.json(result);
});

// 发送消息 —— sender 永远是登录用户
export const sendMessage = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { conversation_id } = parseBody(SendMessageSchema, req.body);

    const conversation = await loadOwnConversation(conversation_id, userId);

    // Text and rich cards (images / location / meetup_time) share this endpoint; the
    // server decides the card shape and stamps sender/timestamps.
    const validated = validateMessagePayload(req.body, {
        senderId: userId,
        participants: [conversation.user1_id, conversation.user2_id],
        allowedImagePrefixes: imagePrefixesFromEnv(process.env.SUPABASE_URL),
    });
    if (!validated.ok) throw badRequest(validated.error);

    const otherId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
    if (isUuid(otherId) && await isBlockedBetween(userId, otherId)) {
        throw forbidden('You cannot message this user');
    }

    const row: Record<string, unknown> = {
        conversation_id: conversation.id,
        sender_id: userId,
        text: validated.value.text,
        message_type: validated.value.message_type,
        is_read: false,
    };
    if (validated.value.content !== null) row.content = validated.value.content;
    const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert([row])
        .select()
        .single();
    if (msgError) throw msgError;

    // Best effort: a stale updated_at only affects list ordering, never the sent message.
    const { error: convError } = await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation.id);
    if (convError) console.error('Error updating conversation:', convError);

    res.status(201).json(message);
});

// 获取对话消息（仅参与者）
export const getMessages = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { conversationId } = parseParams(ConversationIdParamSchema, req.params);
    // `order=desc` + `before=<ISO timestamp>` is the cursor API used by the chat window
    // (newest page first, "load earlier" walks backwards). Default stays asc + offset.
    const { limit, offset, order, before } = parseQuery(GetMessagesQuerySchema, req.query);
    const conversation = await loadOwnConversation(conversationId, userId);
    const descending = order === 'desc';

    let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: !descending })
        .order('id', { ascending: !descending });
    if (before) query = query.lt('created_at', before);
    query = before ? query.limit(limit) : query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data ?? []);
});

// 标记消息为已读（仅参与者；只能标记对方发来的消息）
export const markMessagesAsRead = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { conversationId } = parseParams(ConversationIdParamSchema, req.params);
    const conversation = await loadOwnConversation(conversationId, userId);

    const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversation.id)
        .neq('sender_id', userId)
        .eq('is_read', false);
    if (error) throw error;

    res.json({ success: true });
});

// 删除对话及其消息（仅参与者）
export const deleteConversation = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { conversationId } = parseParams(ConversationIdParamSchema, req.params);
    const conversation = await loadOwnConversation(conversationId, userId);

    const { error: msgError } = await supabase.from('messages').delete().eq('conversation_id', conversation.id);
    if (msgError) throw msgError;

    const { error: convError } = await supabase.from('conversations').delete().eq('id', conversation.id);
    if (convError) throw convError;

    res.json({ success: true });
});
