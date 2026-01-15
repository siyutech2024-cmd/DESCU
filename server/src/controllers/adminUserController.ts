import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { supabase } from '../db/supabase';
import { logAdminAction } from './adminController';

/**
 * 获取用户列表
 */
export const getAdminUsers = async (req: AdminRequest, res: Response) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            is_verified,
            sort_by = 'created_at',
            sort_order = 'desc',
            start_date,
            end_date
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        // 从products表获取唯一的seller信息
        let query = supabase
            .from('products')
            .select('seller_id, seller_name, seller_email, seller_avatar, seller_verified, created_at', { count: 'exact' });

        // 搜索
        if (search) {
            query = query.or(`seller_name.ilike.%${search}%,seller_email.ilike.%${search}%`);
        }

        // 筛选认证状态
        if (is_verified !== undefined) {
            query = query.eq('seller_verified', is_verified === 'true');
        }

        // 筛选日期（基于商品发布时间）
        // 注意：由于没有独立的users表，这里筛选的是"在该时间段内发布过商品的用户"
        if (start_date) {
            query = query.gte('created_at', formatISOStart(String(start_date)));
        }
        if (end_date) {
            query = query.lte('created_at', formatISOEnd(String(end_date)));
        }

        const { data: sellers, error } = await query;

        if (error) throw error;

        // 去重并聚合用户信息
        const uniqueUsers = new Map();

        // 注意：这个循环的性能在数据量大时会有问题
        // 长期方案建议同步 auth.users 到 public.users 表
        for (const seller of sellers || []) {
            if (!uniqueUsers.has(seller.seller_id)) {
                // 如果是按日期筛选的，我们只统计该时间段的活跃用户
                // 这里的逻辑已经通过 query 过滤了

                // 但我们需要统计总的商品数，而不仅仅是筛选时间段内的
                // 所以下面获取详情时，不应该带时间筛选，除非我们要展示"该时间段内的商品数"
                // 现在的逻辑是获取用户所有商品数
                const { count: productCount } = await supabase
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('seller_id', seller.seller_id)
                    .is('deleted_at', null);

                // 获取该用户的对话数量
                const { count: conversationCount } = await supabase
                    .from('conversations')
                    .select('*', { count: 'exact', head: true })
                    .or(`user1_id.eq.${seller.seller_id},user2_id.eq.${seller.seller_id}`)
                    .is('deleted_at', null);

                uniqueUsers.set(seller.seller_id, {
                    id: seller.seller_id,
                    name: seller.seller_name,
                    email: seller.seller_email,
                    avatar: seller.seller_avatar,
                    is_verified: seller.seller_verified || false,
                    product_count: productCount || 0,
                    conversation_count: conversationCount || 0
                });
            }
        }

        const users = Array.from(uniqueUsers.values());
        const total = users.length;

        // 客户端分页
        const paginatedUsers = users.slice(offset, offset + Number(limit));

        res.json({
            users: paginatedUsers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({ error: '获取用户列表失败' });
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
 * 获取用户详情
 */
export const getAdminUser = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;

        // 获取用户基本信息（从products表推断）
        const { data: userProducts, error: productError } = await supabase
            .from('products')
            .select('seller_id, seller_name, seller_email, seller_avatar, seller_verified')
            .eq('seller_id', id)
            .limit(1);

        if (productError) throw productError;

        if (!userProducts || userProducts.length === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const userInfo = userProducts[0];

        // 获取用户的商品列表
        const { data: products, count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact' })
            .eq('seller_id', id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(10);

        // 获取用户的对话列表
        const { data: conversations, count: conversationCount } = await supabase
            .from('conversations')
            .select('*', { count: 'exact' })
            .or(`user1_id.eq.${id},user2_id.eq.${id}`)
            .is('deleted_at', null)
            .order('last_message_time', { ascending: false })
            .limit(10);

        res.json({
            user: {
                id: userInfo.seller_id,
                name: userInfo.seller_name,
                email: userInfo.seller_email,
                avatar: userInfo.seller_avatar,
                is_verified: userInfo.seller_verified || false,
                product_count: productCount || 0,
                conversation_count: conversationCount || 0
            },
            products: products || [],
            conversations: conversations || []
        });
    } catch (error) {
        console.error('获取用户详情失败:', error);
        res.status(500).json({ error: '获取用户详情失败' });
    }
};

/**
 * 更新用户认证状态
 */
export const updateUserVerification = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { is_verified } = req.body;

        // 更新该用户的所有商品
        const { data, error } = await supabase
            .from('products')
            .update({ seller_verified: is_verified })
            .eq('seller_id', id)
            .select();

        if (error) throw error;

        // 记录操作日志
        await logAdminAction(
            req.admin!.id,
            req.admin!.email,
            'verify_user',
            'user',
            id,
            { is_verified },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            message: `用户认证状态已更新`,
            updated_products: data?.length || 0
        });
    } catch (error) {
        console.error('更新用户认证状态失败:', error);
        res.status(500).json({ error: '更新用户认证状态失败' });
    }
};

/**
 * 删除用户（删除该用户的所有商品和对话）
 */
export const deleteAdminUser = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { hard_delete = false } = req.body;

        if (hard_delete) {
            // 硬删除：物理删除所有相关数据
            // 删除用户的商品
            const { error: productsError } = await supabase
                .from('products')
                .delete()
                .eq('seller_id', id);

            if (productsError) throw productsError;

            // 删除用户的对话
            const { error: conversationsError } = await supabase
                .from('conversations')
                .delete()
                .or(`user1_id.eq.${id},user2_id.eq.${id}`);

            if (conversationsError) throw conversationsError;
        } else {
            // 软删除：只标记为已删除
            const { error: productsError } = await supabase
                .from('products')
                .update({
                    deleted_at: new Date().toISOString(),
                    status: 'deleted'
                })
                .eq('seller_id', id);

            if (productsError) throw productsError;

            const { error: conversationsError } = await supabase
                .from('conversations')
                .update({ deleted_at: new Date().toISOString() })
                .or(`user1_id.eq.${id},user2_id.eq.${id}`);

            if (conversationsError) throw conversationsError;
        }

        // 记录操作日志
        await logAdminAction(
            req.admin!.id,
            req.admin!.email,
            hard_delete ? 'hard_delete_user' : 'soft_delete_user',
            'user',
            id,
            { hard_delete },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: '用户已删除' });
    } catch (error) {
        console.error('删除用户失败:', error);
        res.status(500).json({ error: '删除用户失败' });
    }
};
