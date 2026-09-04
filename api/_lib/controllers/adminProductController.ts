import { AdminRequest } from '../middleware/adminAuth.js';
import { supabase } from '../db/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { HttpError, asyncHandler, badRequest, notFound, parseBody, parseParams, parseQuery } from '../lib/http.js';
import { AdminIdParamSchema } from '../schemas/adminGeneral.js';
import {
    AdminProductsQuerySchema,
    BatchUpdateProductsSchema,
    UpdateAdminProductSchema,
    UpdateProductPromotionSchema,
    UpdateProductStatusSchema,
} from '../schemas/adminProducts.js';
import { logAdminAction } from './adminController.js';

// 辅助函数：格式化日期
const formatISOStart = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
    } catch (e) {
        return dateStr;
    }
};

const formatISOEnd = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
    } catch (e) {
        return dateStr;
    }
};

/**
 * 获取商品列表（管理员视图）
 */
export const getAdminProducts = asyncHandler<AdminRequest>(async (req, res) => {
    const {
        page,
        limit,
        search,
        category,
        status,
        is_promoted,
        seller_id,
        sort,
        order,
        sort_by, // 兼容旧参数
        sort_order, // 兼容旧参数
        include_deleted,
        minPrice,
        maxPrice,
        startDate,
        endDate,
        promotedOnly
    } = parseQuery(AdminProductsQuerySchema, req.query);

    const offset = (page - 1) * limit;

    // Create a dedicated Admin Client to ensure we bypass RLS
    const adminUrl = process.env.SUPABASE_URL;
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminUrl || !adminKey) {
        throw new HttpError(500, 'Server configuration error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const adminClient = createClient(adminUrl, adminKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    let query = adminClient
        .from('products')
        .select('*', { count: 'exact' });

    // 是否包含已删除商品
    if (include_deleted === 'false') {
        query = query.is('deleted_at', null);
    }

    // 搜索
    if (search) {
        query = query.or(`title.ilike.%${search}%,seller_name.ilike.%${search}%,seller_email.ilike.%${search}%`);
    }

    // 基础筛选 - 使用 ilike 进行不区分大小写的匹配
    if (category && category !== 'all') {
        query = query.ilike('category', category);
    }
    if (status && status !== 'all') {
        query = query.eq('status', status);
    }
    if (is_promoted || promotedOnly === 'true') {
        query = query.eq('is_promoted', true);
    }
    if (seller_id) {
        query = query.eq('seller_id', seller_id);
    }

    // 高级筛选：价格范围
    if (minPrice) {
        query = query.gte('price', minPrice);
    }
    if (maxPrice) {
        query = query.lte('price', maxPrice);
    }

    // 高级筛选：日期范围
    if (startDate) {
        // 开始日期的 00:00:00
        query = query.gte('created_at', formatISOStart(startDate));
    }
    if (endDate) {
        // 结束日期的 23:59:59
        query = query.lte('created_at', formatISOEnd(endDate));
    }

    // 排序参数处理 (优先使用 sort/order，回退使用 sort_by/sort_order)
    const finalSort = sort || sort_by || 'created_at';
    const finalOrder = order || sort_order || 'desc';
    const ascending = finalOrder === 'asc';

    // 特殊排序处理
    if (finalSort === 'views') {
        query = query.order('views_count', { ascending });
    } else if (finalSort === 'price') {
        query = query.order('price', { ascending });
    } else {
        query = query.order('created_at', { ascending });
    }

    const { data, error, count } = await query
        .range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({
        products: data,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    });
});

/**
 * 获取单个商品详情（管理员视图）
 */
export const getAdminProduct = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound('商品不存在');

    // 获取相关对话数量
    const { count: conversationCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id)
        .is('deleted_at', null);

    res.json({
        product: data,
        conversationCount: conversationCount || 0
    });
});

/**
 * 更新商品信息
 */
export const updateAdminProduct = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);
    // 不允许通过此接口修改 id / seller_id / created_at（schema 已剔除）
    const updates = parseBody(UpdateAdminProductSchema, req.body);

    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;

    // 记录操作日志
    await logAdminAction(
        req.admin!.id,
        req.admin!.email,
        'update',
        'product',
        id,
        { updates },
        req.ip,
        req.get('user-agent')
    );

    res.json({ product: data });
});

/**
 * 软删除商品
 */
export const deleteAdminProduct = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);

    const { data, error } = await supabase
        .from('products')
        .update({
            deleted_at: new Date().toISOString(),
            status: 'deleted'
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;

    // 记录操作日志
    await logAdminAction(
        req.admin!.id,
        req.admin!.email,
        'delete',
        'product',
        id,
        {},
        req.ip,
        req.get('user-agent')
    );

    res.json({ message: '商品已删除', product: data });
});

/**
 * 恢复已删除商品
 */
export const restoreAdminProduct = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);

    const { data, error } = await supabase
        .from('products')
        .update({
            deleted_at: null,
            status: 'active'
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;

    // 记录操作日志
    await logAdminAction(
        req.admin!.id,
        req.admin!.email,
        'restore',
        'product',
        id,
        {},
        req.ip,
        req.get('user-agent')
    );

    res.json({ message: '商品已恢复', product: data });
});

/**
 * 更新商品状态
 */
export const updateProductStatus = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);
    const { status } = parseBody(UpdateProductStatusSchema, req.body);

    const { data, error } = await supabase
        .from('products')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;

    // 记录操作日志
    await logAdminAction(
        req.admin!.id,
        req.admin!.email,
        'update_status',
        'product',
        id,
        { status },
        req.ip,
        req.get('user-agent')
    );

    res.json({ message: '状态已更新', product: data });
});

/**
 * 设置商品推广状态
 */
export const updateProductPromotion = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);
    const { is_promoted } = parseBody(UpdateProductPromotionSchema, req.body);

    const { data, error } = await supabase
        .from('products')
        .update({ is_promoted })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;

    // 记录操作日志
    await logAdminAction(
        req.admin!.id,
        req.admin!.email,
        'promote',
        'product',
        id,
        { is_promoted },
        req.ip,
        req.get('user-agent')
    );

    res.json({ message: '推广状态已更新', product: data });
});

/**
 * 批量操作商品
 */
const BATCH_UPDATABLE_COLUMNS = new Set(['category', 'status', 'is_promoted', 'deleted_at', 'updated_at']);

export const batchUpdateProducts = asyncHandler<AdminRequest>(async (req, res) => {
    // 支持两种参数格式：
    // 1. 旧格式: product_ids, action, data
    // 2. 新格式: productIds, updates
    const { product_ids, action, data: updateData, productIds, updates: directUpdates } = parseBody(BatchUpdateProductsSchema, req.body);

    const ids = productIds || product_ids;
    if (!ids || ids.length === 0) throw badRequest('无效的商品ID列表');

    let updates: Record<string, unknown>;

    if (directUpdates) {
        // 直接使用的是新格式的 updates 对象 —— 只允许批量场景需要的列
        const unknown = Object.keys(directUpdates).filter(k => !BATCH_UPDATABLE_COLUMNS.has(k));
        if (unknown.length) throw badRequest(`不允许批量修改字段: ${unknown.join(', ')}`);
        updates = directUpdates;
    } else {
        // 兼容旧格式 action
        switch (action) {
            case 'delete':
                updates = { deleted_at: new Date().toISOString(), status: 'deleted' };
                break;
            case 'activate':
                updates = { status: 'active' };
                break;
            case 'deactivate':
                updates = { status: 'inactive' };
                break;
            case 'promote':
                updates = { is_promoted: true };
                break;
            case 'unpromote':
                updates = { is_promoted: false };
                break;
            case 'custom':
                if (!updateData) throw badRequest('无效的操作类型');
                updates = updateData;
                break;
            default:
                // 没有 action 且没有 directUpdates
                throw badRequest('无效的操作类型');
        }
    }

    // 执行批量更新
    // 注意：Supabase JS 客户端的 update().in() 只能更新所有匹配的行为相同的值
    // 这对于我们的场景是适用的（批量设为推荐、批量删除等）
    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .in('id', ids)
        .select();
    if (error) throw error;

    // 记录操作日志
    await logAdminAction(
        req.admin!.id,
        req.admin!.email,
        'batch_update',
        'product',
        ids.join(','),
        { count: ids.length, updates },
        req.ip,
        req.get('user-agent')
    );

    res.json({
        message: `成功更新 ${data?.length || 0} 个商品`,
        updated: data?.length || 0,
        products: data
    });
});
