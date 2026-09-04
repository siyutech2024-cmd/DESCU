import { AdminRequest } from '../middleware/adminAuth.js';
import { supabase } from '../db/supabase.js';
import { asyncHandler, notFound, parseBody, parseParams, parseQuery } from '../lib/http.js';
import { AdminIdParamSchema } from '../schemas/adminGeneral.js';
import { AdminConversationsQuerySchema, FlagMessageSchema } from '../schemas/adminMessages.js';
import { HardDeleteSchema } from '../schemas/adminUsers.js';
import { logAdminAction } from './adminController.js';

/**
 * 获取对话列表
 */
export const getAdminConversations = asyncHandler<AdminRequest>(async (req, res) => {
    const {
        page,
        limit,
        product_id,
        user_id,
        include_deleted,
        sort_by,
        sort_order
    } = parseQuery(AdminConversationsQuerySchema, req.query);

    const offset = (page - 1) * limit;

    let query = supabase
        .from('conversations')
        .select('*', { count: 'exact' });

    // 是否包含已删除对话
    if (include_deleted === 'false') {
        query = query.is('deleted_at', null);
    }

    // 筛选 (ids are validated UUIDs, safe to interpolate into the filter)
    if (product_id) {
        query = query.eq('product_id', product_id);
    }
    if (user_id) {
        query = query.or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`);
    }

    // 排序
    const ascending = sort_order === 'asc';
    // 映射前端可能传过来的 last_message_time 为数据库实际存在的 updated_at
    const dbSortBy = sort_by === 'last_message_time' ? 'updated_at' : sort_by;
    query = query.order(dbSortBy, { ascending });

    const { data, error, count } = await query
        .range(offset, offset + limit - 1);
    if (error) throw error;

    const rows = data || [];
    // One query for every product on the page; message counts are cheap HEAD requests run in parallel.
    const productIds = [...new Set(rows.map(c => c.product_id).filter(Boolean))];
    const [productsRes, counts] = await Promise.all([
        productIds.length
            ? supabase.from('products').select('id, title, images').in('id', productIds)
            : Promise.resolve({ data: [] as any[], error: null }),
        Promise.all(rows.map(c =>
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).is('deleted_at', null)
                .then(r => r.count || 0)
        )),
    ]);
    if (productsRes.error) throw productsRes.error;
    const productById = new Map((productsRes.data || []).map((p: any) => [p.id, p]));

    const conversationsWithStats = rows.map((conversation, i) => {
        const product = productById.get(conversation.product_id);
        return {
            ...conversation,
            message_count: counts[i],
            product_title: product?.title || 'Unknown',
            product_image: product?.images?.[0] || ''
        };
    });

    res.json({
        conversations: conversationsWithStats,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    });
});

/**
 * 获取对话详情和消息
 */
export const getAdminConversation = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);

    // 获取对话信息
    const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (convError) throw convError;
    if (!conversation) throw notFound('对话不存在');

    // 获取消息列表
    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .is('deleted_at', null)
        .order('timestamp', { ascending: true });
    if (msgError) throw msgError;

    // 获取商品信息 (best effort: a deleted product still leaves the conversation readable)
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
});

/**
 * 删除对话
 */
export const deleteAdminConversation = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);
    const { hard_delete } = parseBody(HardDeleteSchema, req.body);

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
        id,
        { hard_delete },
        req.ip,
        req.get('user-agent')
    );

    res.json({ message: '对话已删除' });
});

/**
 * 删除消息
 */
export const deleteAdminMessage = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);
    const { hard_delete } = parseBody(HardDeleteSchema, req.body);

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
        id,
        { hard_delete },
        req.ip,
        req.get('user-agent')
    );

    res.json({ message: '消息已删除' });
});

/**
 * 标记消息为违规
 */
export const flagAdminMessage = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);
    const { is_flagged, flag_reason } = parseBody(FlagMessageSchema, req.body);

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
        id,
        { is_flagged, flag_reason },
        req.ip,
        req.get('user-agent')
    );

    res.json({ message: '消息状态已更新', data });
});
