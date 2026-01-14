import { supabase } from './supabase';
import { API_BASE_URL } from './apiConfig';

// 创建或获取对话
export const createOrGetConversation = async (
    productId: string,
    user1Id: string,
    user2Id: string
): Promise<any> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                user1_id: user1Id,
                user2_id: user2Id,
            }),
        });

        if (!response.ok) throw new Error('Failed to create conversation');
        return await response.json();
    } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
    }
};

// 获取用户所有对话
export const getUserConversations = async (userId: string): Promise<any[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/conversations/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch conversations');
        return await response.json();
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
        const response = await fetch(`${API_BASE_URL}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation_id: conversationId,
                sender_id: senderId,
                text,
            }),
        });

        if (!response.ok) throw new Error('Failed to send message');
        return await response.json();
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
        const response = await fetch(
            `${API_BASE_URL}/api/messages/${conversationId}?limit=${limit}&offset=${offset}`
        );
        if (!response.ok) throw new Error('Failed to fetch messages');
        return await response.json();
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
        const response = await fetch(`${API_BASE_URL}/api/messages/${conversationId}/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });

        if (!response.ok) throw new Error('Failed to mark messages as read');
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
