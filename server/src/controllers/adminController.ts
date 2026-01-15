import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { supabase } from '../db/supabase';

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

/**
 * 获取数据报表统计
 */
export const getReportsData = async (req: AdminRequest, res: Response) => {
    try {
        const { timeRange = '7d' } = req.query;

        // 计算时间范围
        const now = new Date();
        let startDate: Date;

        switch (timeRange) {
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // 获取销售趋势（按日期统计商品数量）
        const { data: salesTrend, error: salesError } = await supabase
            .rpc('get_sales_trend', {
                start_date: startDate.toISOString(),
                end_date: now.toISOString()
            })
            .order('date', { ascending: true });

        // 获取用户增长趋势
        const { data: userGrowth, error: userError } = await supabase
            .rpc('get_user_growth', {
                start_date: startDate.toISOString(),
                end_date: now.toISOString()
            })
            .order('date', { ascending: true });

        // 获取分类统计
        const { data: categoryStats, error: categoryError } = await supabase
            .from('products')
            .select('category')
            .is('deleted_at', null);

        // 统计每个分类的数量
        const categoryCounts: Record<string, number> = {};
        categoryStats?.forEach(item => {
            const category = item.category || '未分类';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });

        const categoryDistribution = Object.entries(categoryCounts).map(([name, count]) => ({
            name,
            count,
            percentage: categoryStats ? Math.round((count / categoryStats.length) * 100) : 0
        }));

        // 获取热门商品 Top 10
        const { data: topProducts, error: topError } = await supabase
            .from('products')
            .select(`
                id,
                title,
                price,
                currency,
                category,
                seller_name,
                views,
                created_at
            `)
            .is('deleted_at', null)
            .order('views', { ascending: false })
            .limit(10);

        // 获取活跃用户 Top 10（按商品发布数量）
        const { data: activeUsers, error: activeError } = await supabase
            .from('products')
            .select('seller_id, seller_name, seller_email')
            .is('deleted_at', null);

        const userProductCounts: Record<string, { name: string; email: string; count: number }> = {};
        activeUsers?.forEach(item => {
            const key = item.seller_id;
            if (!userProductCounts[key]) {
                userProductCounts[key] = {
                    name: item.seller_name,
                    email: item.seller_email,
                    count: 0
                };
            }
            userProductCounts[key].count++;
        });

        const topUsers = Object.values(userProductCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        res.json({
            salesTrend: salesTrend || [],
            userGrowth: userGrowth || [],
            categoryDistribution,
            topProducts: topProducts || [],
            topUsers
        });
    } catch (error) {
        console.error('获取报表数据失败:', error);
        res.status(500).json({ error: '获取报表数据失败' });
    }
};

/**
 * 获取系统设置
 */
export const getSystemSettings = async (req: AdminRequest, res: Response) => {
    try {
        const { data: settings, error } = await supabase
            .from('system_settings')
            .select('*')
            .order('setting_key', { ascending: true });

        if (error) {
            console.error('获取系统设置失败:', error);
            // 如果表不存在，返回默认设置
            return res.json({
                settings: [
                    { setting_key: 'site_name', setting_value: 'DESCU', description: '网站名称' },
                    { setting_key: 'max_upload_size', setting_value: '10', description: '最大上传文件大小(MB)' },
                    { setting_key: 'enable_registration', setting_value: 'true', description: '是否开放注册' },
                    { setting_key: 'enable_ai_analysis', setting_value: 'true', description: '是否启用AI分析' },
                    { setting_key: 'maintenance_mode', setting_value: 'false', description: '维护模式' }
                ]
            });
        }

        res.json({ settings: settings || [] });
    } catch (error) {
        console.error('获取系统设置失败:', error);
        res.status(500).json({ error: '获取系统设置失败' });
    }
};

/**
 * 更新系统设置
 */
export const updateSystemSettings = async (req: AdminRequest, res: Response) => {
    try {
        const { setting_key, setting_value, description } = req.body;

        if (!setting_key || setting_value === undefined) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 尝试插入或更新设置
        const { data, error } = await supabase
            .from('system_settings')
            .upsert({
                setting_key,
                setting_value: String(setting_value),
                description: description || null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'setting_key'
            })
            .select()
            .single();

        if (error) throw error;

        // 记录操作日志
        if (req.admin) {
            await logAdminAction(
                req.admin.id,
                req.admin.email,
                'update',
                'system_setting',
                setting_key,
                { old_value: null, new_value: setting_value },
                req.ip,
                req.get('user-agent')
            );
        }

        res.json({ message: '设置已更新', setting: data });
    } catch (error) {
        console.error('更新系统设置失败:', error);
        res.status(500).json({ error: '更新系统设置失败' });
    }
};

/**
 * 批量更新系统设置
 */
export const batchUpdateSettings = async (req: AdminRequest, res: Response) => {
    try {
        const { settings } = req.body;

        if (!Array.isArray(settings) || settings.length === 0) {
            return res.status(400).json({ error: '无效的设置数据' });
        }

        const updates = settings.map(s => ({
            setting_key: s.setting_key,
            setting_value: String(s.setting_value),
            description: s.description || null,
            updated_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('system_settings')
            .upsert(updates, { onConflict: 'setting_key' })
            .select();

        if (error) throw error;

        // 记录操作日志
        if (req.admin) {
            await logAdminAction(
                req.admin.id,
                req.admin.email,
                'batch_update',
                'system_settings',
                'multiple',
                { count: settings.length },
                req.ip,
                req.get('user-agent')
            );
        }

        res.json({ message: '设置已批量更新', settings: data });
    } catch (error) {
        console.error('批量更新设置失败:', error);
        res.status(500).json({ error: '批量更新设置失败' });
    }
};
