import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth.js';
import { supabase } from '../db/supabase.js';
import { logAdminAction } from './adminController.js';

/**
 * 获取对话列表
 */
export const getAdminConversations = async (req: AdminRequest, res: Response) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            product_id,
            user_id,
            include_deleted = 'false',
            sort_by = 'updated_at',
            sort_order = 'desc'
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        let query = supabase
            .from('conversations')
            .select('*', { count: 'exact' });

        // 是否包含已删除对话
        if (include_deleted === 'false') {
            query = query.is('deleted_at', null);
        }

        // 筛选
        if (product_id) {
            query = query.eq('product_id', product_id);
        }
        if (user_id) {
            query = query.or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`);
        }

        // 排序
        const ascending = sort_order === 'asc';
        // 映射前端可能传过来的 last_message_time 为数据库实际存在的 updated_at
        const dbSortBy = String(sort_by) === 'last_message_time' ? 'updated_at' : String(sort_by);
        query = query.order(dbSortBy, { ascending });

        const { data, error, count } = await query
            .range(offset, offset + Number(limit) - 1);

        if (error) throw error;

        // 获取每个对话的消息数量
        const conversationsWithStats = await Promise.all(
            (data || []).map(async (conversation) => {
                const { count: messageCount } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversation_id', conversation.id)
                    .is('deleted_at', null);

                // 获取商品信息
                const { data: product } = await supabase
                    .from('products')
                    .select('title, images')
                    .eq('id', conversation.product_id)
                    .single();

                return {
                    ...conversation,
                    message_count: messageCount || 0,
                    product_title: product?.title || 'Unknown',
                    product_image: product?.images?.[0] || ''
                };
            })
        );

        res.json({
            conversations: conversationsWithStats,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit))
            }
        });
    } catch (error) {
        console.error('获取对话列表失败:', error);
        res.status(500).json({ error: '获取对话列表失败' });
    }
};

/**
 * 获取对话详情和消息
 */
export const getAdminConversation = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;

        // 获取对话信息
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', id)
            .single();

        if (convError) throw convError;

        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }

        // 获取消息列表
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', id)
            .is('deleted_at', null)
            .order('timestamp', { ascending: true });

        if (msgError) throw msgError;

        // 获取商品信息
        const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', conversation.product_id)
            .single();

        res.json({
            conversation: {
                ...conversation,
                product
            },
            messages: messages || []
        });
    } catch (error) {
        console.error('获取对话详情失败:', error);
        res.status(500).json({ error: '获取对话详情失败' });
    }
};

/**
 * 删除对话
 */
export const deleteAdminConversation = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { hard_delete = false } = req.body;

        if (hard_delete) {
            // 硬删除：物理删除
            const { error } = await supabase
                .from('conversations')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } else {
            // 软删除
            const { error } = await supabase
                .from('conversations')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
        }

        // 记录操作日志
        await logAdminAction(
            req.admin!.id,
            req.admin!.email,
            hard_delete ? 'hard_delete_conversation' : 'soft_delete_conversation',
            'conversation',
            String(id),
            { hard_delete },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '对话已删除' });
    } catch (error) {
        console.error('删除对话失败:', error);
        res.status(500).json({ error: '删除对话失败' });
    }
};

/**
 * 删除消息
 */
export const deleteAdminMessage = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { hard_delete = false } = req.body;

        if (hard_delete) {
            // 硬删除
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } else {
            // 软删除
            const { error } = await supabase
                .from('messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
        }

        // 记录操作日志
        await logAdminAction(
            req.admin!.id,
            req.admin!.email,
            hard_delete ? 'hard_delete_message' : 'soft_delete_message',
            'message',
            String(id),
            { hard_delete },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '消息已删除' });
    } catch (error) {
        console.error('删除消息失败:', error);
        res.status(500).json({ error: '删除消息失败' });
    }
};

/**
 * 标记消息为违规
 */
export const flagAdminMessage = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { is_flagged, flag_reason } = req.body;

        const { data, error } = await supabase
            .from('messages')
            .update({
                is_flagged,
                flag_reason: is_flagged ? flag_reason : null
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 记录操作日志
        await logAdminAction(
            req.admin!.id,
            req.admin!.email,
            'flag_message',
            'message',
            String(id),
            { is_flagged, flag_reason },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '消息状态已更新', data });
    } catch (error) {
        console.error('标记消息失败:', error);
        res.status(500).json({ error: '标记消息失败' });
    }
};
