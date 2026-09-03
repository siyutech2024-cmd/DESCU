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

// 获取对话消息
export const getMessages = async (
    conversationId: string,
    limit = 50,
    offset = 0
): Promise<any[]> => {
    try {
        return await api.get<any[]>(`/api/messages/${conversationId}`, { params: { limit, offset }, auth: 'required' });
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
