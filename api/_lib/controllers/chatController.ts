import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { isBlockedBetween } from '../services/moderationService.js';

/**
 * Chat controller.
 *
 * All handlers run behind `requireAuth` and use the service-role client, so RLS does
 * NOT protect these queries — every handler must verify that `req.user.id` is a
 * participant of the conversation it touches. Identifiers coming from the client are
 * validated as UUIDs before being used in any filter (PostgREST `.or()` filters are
 * strings, so unvalidated input there is an injection vector).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

const MAX_MESSAGE_LENGTH = 4000;
const MAX_PAGE_SIZE = 100;

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

/** Load a conversation and assert the caller participates; responds 404/403 on failure. */
const loadOwnConversation = async (conversationId: unknown, userId: string, res: Response): Promise<ConversationRow | null> => {
    if (!isUuid(conversationId)) {
        res.status(400).json({ error: 'Invalid conversation id' });
        return null;
    }
    const { data, error } = await supabase
        .from('conversations')
        .select('id, product_id, user1_id, user2_id, updated_at')
        .eq('id', conversationId)
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        res.status(404).json({ error: 'Conversation not found' });
        return null;
    }
    if (!isParticipant(data, userId)) {
        res.status(403).json({ error: 'Not a participant of this conversation' });
        return null;
    }
    return data as ConversationRow;
};

// 创建（或获取已存在的）对话 —— 调用者必须是双方之一
export const createConversation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { product_id, user1_id, user2_id } = req.body ?? {};

        if (!isUuid(product_id) || !isUuid(user1_id) || !isUuid(user2_id)) {
            return res.status(400).json({ error: 'Invalid ids' });
        }
        if (user1_id === user2_id) {
            return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
        }
        if (userId !== user1_id && userId !== user2_id) {
            return res.status(403).json({ error: 'You must be a participant of the conversation' });
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, seller_id')
            .eq('id', product_id)
            .maybeSingle();
        if (productError) throw productError;
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const otherId = userId === user1_id ? user2_id : user1_id;
        if (product.seller_id !== userId && product.seller_id !== otherId) {
            return res.status(400).json({ error: 'Conversation must include the product seller' });
        }
        if (await isBlockedBetween(userId, otherId)) {
            return res.status(403).json({ error: 'You cannot message this user' });
        }

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
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
};

// 获取当前用户的所有对话（URL 中的 userId 必须等于登录用户）
export const getUserConversations = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        if (req.params.userId !== userId) {
            return res.status(403).json({ error: 'Cannot read another user\'s conversations' });
        }

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

        const [{ data: products }, { data: users }, { data: recentMessages }, { data: unreadRows }, { data: orders }] = await Promise.all([
            supabase.from('products').select('id, title, images, seller_id, seller_name, seller_avatar').in('id', productIds),
            supabase.from('users').select('id, name, avatar_url').in('id', userIds),
            // Newest messages across all of the user's conversations; the first one seen per
            // conversation is its last message. Bounded so a very chatty thread can't starve
            // the others of a preview (they then fall back to no preview, never to an error).
            supabase.from('messages')
                .select('conversation_id, text, sender_id, message_type, created_at, is_read')
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false })
                .limit(Math.min(conversationIds.length * 25, 5000)),
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
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

// 发送消息 —— sender 永远是登录用户
export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { conversation_id, text } = req.body ?? {};

        if (typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }
        if (text.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
        }

        const conversation = await loadOwnConversation(conversation_id, userId, res);
        if (!conversation) return;

        const otherId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
        if (isUuid(otherId) && await isBlockedBetween(userId, otherId)) {
            return res.status(403).json({ error: 'You cannot message this user' });
        }

        const { data: message, error: msgError } = await supabase
            .from('messages')
            .insert([{ conversation_id: conversation.id, sender_id: userId, text: text.trim() }])
            .select()
            .single();
        if (msgError) throw msgError;

        const { error: convError } = await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversation.id);
        if (convError) console.error('Error updating conversation:', convError);

        res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// 获取对话消息（仅参与者）
export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const conversation = await loadOwnConversation(req.params.conversationId, userId, res);
        if (!conversation) return;

        const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 50, 1), MAX_PAGE_SIZE);
        const offset = Math.max(parseInt(String(req.query.offset), 10) || 0, 0);
        // `order=desc` + `before=<ISO timestamp>` is the cursor API used by the chat window
        // (newest page first, "load earlier" walks backwards). Default stays asc + offset.
        const descending = req.query.order === 'desc';
        const before = typeof req.query.before === 'string' ? new Date(req.query.before) : null;
        if (before && Number.isNaN(before.getTime())) {
            return res.status(400).json({ error: 'Invalid `before` cursor' });
        }

        let query = supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: !descending })
            .order('id', { ascending: !descending });
        if (before) query = query.lt('created_at', before.toISOString());
        query = before ? query.limit(limit) : query.range(offset, offset + limit - 1);

        const { data, error } = await query;
        if (error) throw error;

        res.json(data ?? []);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

// 标记消息为已读（仅参与者；只能标记对方发来的消息）
export const markMessagesAsRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const conversation = await loadOwnConversation(req.params.conversationId, userId, res);
        if (!conversation) return;

        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversation.id)
            .neq('sender_id', userId)
            .eq('is_read', false);
        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};

// 删除对话及其消息（仅参与者）
export const deleteConversation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const conversation = await loadOwnConversation(req.params.conversationId, userId, res);
        if (!conversation) return;

        const { error: msgError } = await supabase.from('messages').delete().eq('conversation_id', conversation.id);
        if (msgError) throw msgError;

        const { error: convError } = await supabase.from('conversations').delete().eq('id', conversation.id);
        if (convError) throw convError;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
};
