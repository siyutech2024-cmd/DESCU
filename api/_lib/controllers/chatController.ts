import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';

// 创建新对话
import { createClient } from '@supabase/supabase-js';

// Helper to create authenticated client
const getAuthClient = (authHeader?: string) => {
    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!sbUrl || !sbKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be configured');
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return supabase;
    }

    return createClient(sbUrl, sbKey, {
        global: { headers: { Authorization: authHeader || '' } }
    });
};

// 创建新对话
export const createConversation = async (req: Request, res: Response) => {
    try {
        const { product_id, user1_id, user2_id } = req.body;
        const supabaseClient = getAuthClient(req.headers.authorization);

        // 严格验证 ID
        if (!user1_id || user1_id === 'undefined' || !user2_id || user2_id === 'undefined') {
            console.error('Invalid user IDs for conversation:', { user1_id, user2_id });
            return res.status(400).json({ error: '无效的用户ID (Invalid user IDs)' });
        }

        // 检查对话是否已存在 (Use scoped client if possible, but reading requires permission. 
        // If creating for two other people (unlikely), this might fail. User usually creates for self and other.)
        const { data: existing } = await supabaseClient
            .from('conversations')
            .select('*')
            .eq('product_id', product_id)
            .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`)
            .single();

        if (existing) {
            return res.json(existing);
        }

        // 创建新对话
        const { data, error } = await supabaseClient
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
        const supabaseClient = getAuthClient(req.headers.authorization);

        console.log(`[Chat] Fetching conversations for user: ${userId}`);

        const { data, error } = await supabaseClient
            .from('conversations')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('[Chat] DB Error:', error);
            throw error;
        }

        const conversationsWithDetails = await Promise.all(
            (data || []).map(async (conversation) => {
                // Public info read (Products) works with anon client too, but scoped is safer/consistent
                const { data: product } = await supabaseClient
                    .from('products')
                    .select('title, images, seller_id, seller_name, seller_avatar')
                    .eq('id', conversation.product_id)
                    .single();

                return {
                    ...conversation,
                    productTitle: product?.title || '未知商品',
                    productImage: product?.images?.[0] || '',
                    sellerInfo: product ? {
                        id: product.seller_id,
                        name: product.seller_name,
                        avatar: product.seller_avatar
                    } : null
                };
            })
        );

        console.log(`[Chat] Found ${data?.length || 0} conversations for user: ${userId}`);
        res.json(conversationsWithDetails);
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

        // 更新对话的新消息时间 (利用 trigger 或 显式更新 updated_at)
        // 注意：数据库中没有 last_message_time 字段，使用 updated_at 代替
        const { error: convError } = await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
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
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);

        console.log(`[Chat] getMessages for ${conversationId}: found ${data?.length || 0} messages`);

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
