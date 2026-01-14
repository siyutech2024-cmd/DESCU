import { Request, Response } from 'express';
import { supabase } from '../index';

// 创建新对话
export const createConversation = async (req: Request, res: Response) => {
    try {
        const { product_id, user1_id, user2_id } = req.body;

        // 检查对话是否已存在
        const { data: existing } = await supabase
            .from('conversations')
            .select('*')
            .eq('product_id', product_id)
            .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`)
            .single();

        if (existing) {
            return res.json(existing);
        }

        // 创建新对话
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

// 获取用户的所有对话
export const getUserConversations = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('last_message_time', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

// 发送消息
export const sendMessage = async (req: Request, res: Response) => {
    try {
        const { conversation_id, sender_id, text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        // 插入消息
        const { data: message, error: msgError } = await supabase
            .from('messages')
            .insert([{ conversation_id, sender_id, text: text.trim() }])
            .select()
            .single();

        if (msgError) throw msgError;

        // 更新对话的最后消息时间
        const { error: convError } = await supabase
            .from('conversations')
            .update({ last_message_time: new Date().toISOString() })
            .eq('id', conversation_id);

        if (convError) console.error('Error updating conversation:', convError);

        res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// 获取对话的所有消息
export const getMessages = async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

// 标记消息为已读
export const markMessagesAsRead = async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const { userId } = req.body;

        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', userId)
            .eq('is_read', false);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};
