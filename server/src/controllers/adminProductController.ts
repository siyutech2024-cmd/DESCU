import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { supabase } from '../index';
import { logAdminAction } from './adminController';

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
            sort_by = 'created_at',
            sort_order = 'desc',
            include_deleted = 'false'
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        let query = supabase
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

        // 筛选
        if (category) {
            query = query.eq('category', category);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (is_promoted) {
            query = query.eq('is_promoted', is_promoted === 'true');
        }
        if (seller_id) {
            query = query.eq('seller_id', seller_id);
        }

        // 排序
        const ascending = sort_order === 'asc';
        query = query.order(String(sort_by), { ascending });

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
            id,
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
            id,
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
            id,
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
            id,
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
            id,
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
        const { product_ids, action, data: updateData } = req.body;

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            return res.status(400).json({ error: '无效的商品ID列表' });
        }

        let updates: any = {};

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
                return res.status(400).json({ error: '无效的操作类型' });
        }

        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .in('id', product_ids)
            .select();

        if (error) throw error;

        // 记录操作日志
        await logAdminAction(
            req.admin!.id,
            req.admin!.email,
            `batch_${action}`,
            'product',
            product_ids.join(','),
            { count: product_ids.length, updates },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            message: `成功更新 ${data?.length || 0} 个商品`,
            products: data
        });
    } catch (error) {
        console.error('批量更新商品失败:', error);
        res.status(500).json({ error: '批量更新商品失败' });
    }
};
