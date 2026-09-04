import { supabase } from './supabase';
import { api } from '@/lib/api/client';

// 创建或获取对话
export const createOrGetConversation = async (
    productId: string,
    user1Id: string,
    user2Id: string
): Promise<any> => {
    try {
        return await api.post<any>('/api/conversations', {
            product_id: productId,
            user1_id: user1Id,
            user2_id: user2Id,
        }, { auth: 'required' });
    } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
    }
};

// 获取用户所有对话
export const getUserConversations = async (userId: string): Promise<any[]> => {
    try {
        return await api.get<any[]>(`/api/users/${userId}/conversations`, { auth: 'required' });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return [];
    }
};

// 发送消息
export const sendMessage = async (
    conversationId: string,
    senderId: string,
    text: string
): Promise<any> => {
    try {
        return await api.post<any>('/api/messages', {
            conversation_id: conversationId,
            sender_id: senderId, // ignored server-side: sender is always the authenticated user
            text,
        }, { auth: 'required' });
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

export type RichMessageType = 'images' | 'location' | 'meetup_time';

/**
 * 发送富消息（图片 / 位置 / 见面时间）。服务端校验并补全卡片字段（sender、时间戳），
 * 客户端不再直接写 messages 表。
 */
export const sendRichMessage = async (
    conversationId: string,
    messageType: RichMessageType,
    content: Record<string, unknown>,
    text?: string,
): Promise<any> => {
    return api.post<any>('/api/messages', {
        conversation_id: conversationId,
        message_type: messageType,
        content,
        text,
    }, { auth: 'required' });
};

export interface GetMessagesOptions {
    /** Page size (server caps at 100). Default 50. */
    limit?: number;
    /** `asc` (default, legacy offset paging) or `desc` (newest first, cursor paging). */
    order?: 'asc' | 'desc';
    /** ISO timestamp: only return messages strictly older than this. Use with `order: 'desc'`. */
    before?: string;
    /** Legacy offset paging (ascending order only). */
    offset?: number;
}

/**
 * 获取对话消息
 *
 * Accepts either the new options object `{ limit, order, before }` or the legacy
 * positional `(limit, offset)` arguments.
 */
export const getMessages = async (
    conversationId: string,
    limitOrOptions: number | GetMessagesOptions = 50,
    offset = 0
): Promise<any[]> => {
    const opts: GetMessagesOptions =
        typeof limitOrOptions === 'number' ? { limit: limitOrOptions, offset } : limitOrOptions;
    const limit = opts.limit ?? 50;
    const params: Record<string, string | number | undefined> = { limit };
    if (opts.order === 'desc') {
        params.order = 'desc';
        if (opts.before) params.before = opts.before;
    } else {
        params.offset = opts.offset ?? 0;
    }
    try {
        return await api.get<any[]>(`/api/messages/${conversationId}`, { params, auth: 'required' });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
};

// 标记消息为已读
export const markMessagesAsRead = async (
    conversationId: string,
    userId: string
): Promise<void> => {
    try {
        await api.put(`/api/messages/${conversationId}/read`, { userId }, { auth: 'required' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
};

// Supabase Real-time 订阅消息
export const subscribeToMessages = (
    conversationId: string,
    onNewMessage: (message: any) => void
) => {
    const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
                onNewMessage(payload.new);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// 订阅对话更新
export const subscribeToConversations = (
    userId: string,
    onConversationUpdate: (conversation: any) => void
) => {
    const channel = supabase
        .channel(`conversations:${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'conversations',
            },
            (payload: any) => {
                const conv = payload.new || payload.old;
                // 只处理与当前用户相关的对话
                if (conv && (conv.user1_id === userId || conv.user2_id === userId)) {
                    onConversationUpdate(conv);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// 用户软删除对话（后端保留记录）
export const deleteConversation = async (
    conversationId: string,
    userId: string
): Promise<{ success: boolean }> => {
    try {
        return await api.delete<{ success: boolean }>(`/api/conversations/${conversationId}`, { body: { userId }, auth: 'required' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        throw error;
    }
};
