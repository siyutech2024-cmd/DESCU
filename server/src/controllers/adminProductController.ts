import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth.js';
import { supabase } from '../db/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { logAdminAction } from './adminController.js';

/**
 * 获取商品列表（管理员视图）
 */
export const getAdminProducts = async (req: AdminRequest, res: Response) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            category,
            status,
            is_promoted,
            seller_id,
            sort = 'created_at',
            order = 'desc',
            sort_by, // 兼容旧参数
            sort_order, // 兼容旧参数
            include_deleted = 'false',
            minPrice,
            maxPrice,
            startDate,
            endDate,
            promotedOnly
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        // Create a dedicated Admin Client to ensure we bypass RLS
        const adminUrl = process.env.SUPABASE_URL;
        const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!adminUrl || !adminKey) {
            return res.status(500).json({
                error: 'Server configuration error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
            });
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
        if (category && category !== 'all' && category !== 'undefined') {
            query = query.ilike('category', String(category));
        }
        if (status && status !== 'all' && status !== 'undefined') {
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
            query = query.gte('price', Number(minPrice));
        }
        if (maxPrice) {
            query = query.lte('price', Number(maxPrice));
        }

        // 高级筛选：日期范围
        if (startDate && startDate !== 'undefined') {
            // 开始日期的 00:00:00
            query = query.gte('created_at', formatISOStart(String(startDate)));
        }
        if (endDate && endDate !== 'undefined') {
            // 结束日期的 23:59:59
            query = query.lte('created_at', formatISOEnd(String(endDate)));
        }

        // 排序参数处理 (优先使用 sort/order，回退使用 sort_by/sort_order)
        const finalSort = String(sort || sort_by || 'created_at');
        const finalOrder = String(order || sort_order || 'desc');
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
            .range(offset, offset + Number(limit) - 1);

        if (error) throw error;

        res.json({
            products: data,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit))
            }
        });
    } catch (error) {
        console.error('获取商品列表失败:', error);
        res.status(500).json({ error: '获取商品列表失败' });
    }
};

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
 * 获取单个商品详情（管理员视图）
 */
export const getAdminProduct = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: '商品不存在' });
        }

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
    } catch (error) {
        console.error('获取商品详情失败:', error);
        res.status(500).json({ error: '获取商品详情失败' });
    }
};

/**
 * 更新商品信息
 */
export const updateAdminProduct = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // 不允许通过此接口修改某些字段
        delete updates.id;
        delete updates.seller_id;
        delete updates.created_at;

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
            String(id),
            { updates },
            req.ip,
            req.get('user-agent')
        );

        res.json({ product: data });
    } catch (error) {
        console.error('更新商品失败:', error);
        res.status(500).json({ error: '更新商品失败' });
    }
};

/**
 * 软删除商品
 */
export const deleteAdminProduct = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;

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
            String(id),
            {},
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '商品已删除', product: data });
    } catch (error) {
        console.error('删除商品失败:', error);
        res.status(500).json({ error: '删除商品失败' });
    }
};

/**
 * 恢复已删除商品
 */
export const restoreAdminProduct = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;

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
            String(id),
            {},
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '商品已恢复', product: data });
    } catch (error) {
        console.error('恢复商品失败:', error);
        res.status(500).json({ error: '恢复商品失败' });
    }
};

/**
 * 更新商品状态
 */
export const updateProductStatus = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive', 'pending_review'].includes(status)) {
            return res.status(400).json({ error: '无效的状态值' });
        }

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
            String(id),
            { status },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '状态已更新', product: data });
    } catch (error) {
        console.error('更新商品状态失败:', error);
        res.status(500).json({ error: '更新商品状态失败' });
    }
};

/**
 * 设置商品推广状态
 */
export const updateProductPromotion = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { is_promoted } = req.body;

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
            String(id),
            { is_promoted },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '推广状态已更新', product: data });
    } catch (error) {
        console.error('更新推广状态失败:', error);
        res.status(500).json({ error: '更新推广状态失败' });
    }
};

/**
 * 批量操作商品
 */
export const batchUpdateProducts = async (req: AdminRequest, res: Response) => {
    try {
        // 支持两种参数格式：
        // 1. 旧格式: product_ids, action, data
        // 2. 新格式: productIds, updates
        const { product_ids, action, data: updateData, productIds, updates: directUpdates } = req.body;

        const ids = productIds || product_ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '无效的商品ID列表' });
        }

        let updates: any = {};

        if (directUpdates) {
            // 直接使用的是新格式的 updates 对象
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
                    updates = updateData;
                    break;
                default:
                    // 如果没有 action 且没有 directUpdates，那就是错误
                    if (!directUpdates) {
                        return res.status(400).json({ error: '无效的操作类型' });
                    }
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
    } catch (error) {
        console.error('批量更新商品失败:', error);
        res.status(500).json({ error: '批量更新商品失败' });
    }
};
