import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { supabase } from '../index';

/**
 * 记录管理员操作日志
 */
export const logAdminAction = async (
    adminId: string,
    adminEmail: string,
    actionType: string,
    targetType: string,
    targetId: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string
) => {
    try {
        const { error } = await supabase.from('admin_logs').insert({
            admin_id: adminId,
            admin_email: adminEmail,
            action_type: actionType,
            target_type: targetType,
            target_id: targetId,
            details: details || {},
            ip_address: ipAddress,
            user_agent: userAgent
        });

        if (error) {
            console.error('记录管理员操作日志失败:', error);
        }
    } catch (error) {
        console.error('记录管理员操作日志异常:', error);
    }
};

/**
 * 获取仪表板统计数据
 */
export const getDashboardStats = async (req: AdminRequest, res: Response) => {
    try {
        // 获取商品统计
        const { data: productStats, error: productError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null);

        const { data: productsTodayStats, error: productsTodayError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

        const { data: productsActiveStats, error: productsActiveError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('status', 'active');

        // 获取用户统计（从 auth.users - 需要使用 service role key）
        const { count: totalUsers, error: usersError } = await supabase
            .from('products')
            .select('seller_id', { count: 'exact', head: true });

        // 获取消息统计
        const { count: totalMessages, error: messagesError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null);

        const { count: messagesToday, error: messagesTodayError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .gte('timestamp', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

        // 获取对话统计
        const { count: totalConversations, error: conversationsError } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null);

        // 获取分类统计
        const { data: categoryStats, error: categoryError } = await supabase
            .from('admin_product_stats')
            .select('*');

        // 获取最近7天趋势
        const { data: weeklyTrend, error: weeklyError } = await supabase
            .from('admin_daily_stats')
            .select('*')
            .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('date', { ascending: true });

        // 获取最新商品
        const { data: recentProducts, error: recentError } = await supabase
            .from('products')
            .select(`
        id,
        title,
        price,
        currency,
        category,
        status,
        seller_name,
        seller_email,
        created_at,
        images
      `)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(10);

        res.json({
            stats: {
                totalProducts: productStats?.length || 0,
                productsToday: productsTodayStats?.length || 0,
                activeProducts: productsActiveStats?.length || 0,
                totalUsers: totalUsers || 0,
                totalMessages: totalMessages || 0,
                messagesToday: messagesToday || 0,
                totalConversations: totalConversations || 0
            },
            categoryStats: categoryStats || [],
            weeklyTrend: weeklyTrend || [],
            recentProducts: recentProducts || []
        });
    } catch (error) {
        console.error('获取仪表板统计数据失败:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
};

/**
 * 获取管理员信息
 */
export const getAdminInfo = async (req: AdminRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({ error: '未授权' });
        }

        res.json({
            id: req.admin.id,
            email: req.admin.email,
            role: req.admin.role,
            permissions: req.admin.permissions || []
        });
    } catch (error) {
        console.error('获取管理员信息失败:', error);
        res.status(500).json({ error: '获取管理员信息失败' });
    }
};

/**
 * 获取操作日志列表
 */
export const getAdminLogs = async (req: AdminRequest, res: Response) => {
    try {
        const { page = 1, limit = 50, action_type, target_type, admin_id } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabase
            .from('admin_logs')
            .select('*', { count: 'exact' });

        // 应用筛选
        if (action_type) {
            query = query.eq('action_type', action_type);
        }
        if (target_type) {
            query = query.eq('target_type', target_type);
        }
        if (admin_id) {
            query = query.eq('admin_id', admin_id);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (error) throw error;

        res.json({
            logs: data,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit))
            }
        });
    } catch (error) {
        console.error('获取操作日志失败:', error);
        res.status(500).json({ error: '获取操作日志失败' });
    }
};
