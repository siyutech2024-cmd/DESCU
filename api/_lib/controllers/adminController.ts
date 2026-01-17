import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth.js';
import { supabase } from '../db/supabase.js';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// --- LAZY STRIPE INIT ---
let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
            apiVersion: '2024-12-18.acacia' as any,
        });
    }
    return stripeInstance;
};

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
/**
 * 获取仪表板统计数据
 */
export const getDashboardStats = async (req: AdminRequest, res: Response) => {
    try {
        const todayStr = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        const weekAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Create a dedicated Admin Client to ensure we bypass RLS
        const adminUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Fallback to global client if key missing (will likely fail for RLS but handles dev cases)
        const adminClient = (adminUrl && adminKey)
            ? createClient(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } })
            : supabase;

        console.log('[Dashboard] Using Admin Client:', !!(adminUrl && adminKey));

        // Use Promise.all to run queries in parallel
        const [
            productStats,
            productsToday,
            productsActive,
            // products query for users (legacy logic, kept for stability but could be improved)
            usersStats,
            messageStats,
            messagesToday,
            conversationStats,
            categoryStats,
            weeklyTrend,
            recentProducts
        ] = await Promise.all([
            // 1. Total Products
            adminClient.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
            // 2. Products Today
            adminClient.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', todayStr),
            // 3. Active Products
            adminClient.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
            // 4. Total Users (Detailed count via RPC)
            adminClient.rpc('get_total_users'),
            // 5. Total Messages
            adminClient.from('messages').select('*', { count: 'exact', head: true }).is('deleted_at', null),
            // 6. Messages Today
            adminClient.from('messages').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('timestamp', todayStr),
            // 7. Total Conversations
            adminClient.from('conversations').select('*', { count: 'exact', head: true }).is('deleted_at', null),
            // 8. Category Stats
            adminClient.from('admin_product_stats').select('*'),
            // 9. Weekly Trend
            adminClient.from('admin_daily_stats').select('*').gte('date', weekAgoStr).order('date', { ascending: true }),
            // 10. Recent Products
            adminClient.from('products')
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
                .limit(10)
        ]);

        // Debug logging for all queries
        console.log('[Dashboard] Query Results:');
        console.log('  - adminUrl:', adminUrl ? 'SET' : 'MISSING');
        console.log('  - adminKey:', adminKey ? 'SET' : 'MISSING');
        console.log('  - productStats:', { count: productStats.count, error: productStats.error?.message });
        console.log('  - productsToday:', { count: productsToday.count, error: productsToday.error?.message });
        console.log('  - productsActive:', { count: productsActive.count, error: productsActive.error?.message });
        console.log('  - usersStats:', { data: usersStats.data, error: usersStats.error?.message });
        console.log('  - messageStats:', { count: messageStats.count, error: messageStats.error?.message });
        console.log('  - messagesToday:', { count: messagesToday.count, error: messagesToday.error?.message });
        console.log('  - conversationStats:', { count: conversationStats.count, error: conversationStats.error?.message });
        console.log('  - categoryStats:', { data: categoryStats.data?.length, error: categoryStats.error?.message });
        console.log('  - weeklyTrend:', { data: weeklyTrend.data?.length, error: weeklyTrend.error?.message });
        console.log('  - recentProducts:', { data: recentProducts.data?.length, error: recentProducts.error?.message });

        // Check for critical errors (optional: we could return partial data)
        if (productStats.error) console.error('Error fetching product stats:', productStats.error);

        res.json({
            stats: {
                totalProducts: productStats.count || 0,
                productsToday: productsToday.count || 0,
                activeProducts: productsActive.count || 0,
                totalUsers: usersStats.data || 0,
                totalMessages: messageStats.count || 0,
                messagesToday: messagesToday.count || 0,
                totalConversations: conversationStats.count || 0
            },
            categoryStats: categoryStats.data || [],
            weeklyTrend: weeklyTrend.data || [],
            recentProducts: recentProducts.data || []
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

/**
 * 获取订单列表 (Transactions)
 */
export const getAdminOrders = async (req: AdminRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        // 1. Fetch Orders (Raw) - Only join products (public schema)
        let query = supabase
            .from('orders')
            .select('*, products(title, images)', { count: 'exact' });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: orders, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (error) throw error;

        if (!orders || orders.length === 0) {
            return res.json({
                orders: [],
                total: count || 0,
                page: Number(page),
                totalPages: 0
            });
        }

        // 2. Collect User IDs
        const userIds = new Set<string>();
        orders.forEach(o => {
            if (o.buyer_id) userIds.add(o.buyer_id);
            if (o.seller_id) userIds.add(o.seller_id);
        });

        // 3. Fetch Emails manually (Using Auth Admin API would be ideal, but requires loop or RPC)
        // Alternatively, use a public profile table if available.
        // Since we are admin/service_role, we can actually just query 'auth.users' strictly using RPC or just iterate.
        // For performance, let's try to map what we can. 
        // Note: supabase-js 'service_role' CANNOT directly select from 'auth.users' via .from('auth.users') usually.
        // But we can use auth.admin.listUsers() but it doesn't support "WHERE id IN (...)".

        // Strategy: Iterate and fetch (Parallel). For 20 items, it's fast enough.
        // Or better: Create a map.

        const userMap = new Map<string, string>();

        // To avoid N+1, we can't easily batch fetch users by ID list via standard admin API today without looped 'getUserById'.
        // However, we can use a raw SQL RPC if strictly needed.
        // PRACTICAL APPROACH: Just loop Promise.all. It's an admin dashboard, low traffic.

        const uniqueIds = Array.from(userIds);

        // Note: supabase.auth.admin.getUserById is efficient enough.
        const userPromises = uniqueIds.map(async (uid) => {
            const { data: { user } } = await supabase.auth.admin.getUserById(uid);
            return { id: uid, email: user?.email || 'Unknown' };
        });

        const users = await Promise.all(userPromises);
        users.forEach(u => userMap.set(u.id, u.email));

        // 4. Enrich Orders
        const enrichedOrders = orders.map(o => ({
            ...o,
            buyer: { email: userMap.get(o.buyer_id) || 'Unknown' },
            seller: { email: userMap.get(o.seller_id) || 'Unknown' }
        }));

        res.json({
            orders: enrichedOrders,
            total: count || 0,
            page: Number(page),
            totalPages: Math.ceil((count || 0) / Number(limit))
        });
    } catch (error) {
        console.error('获取订单列表失败:', error);
        res.status(500).json({ error: '获取订单列表失败' });
    }
};

/**
 * 获取纠纷列表 (Disputes)
 */
export const getAdminDisputes = async (req: AdminRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, status = 'open' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabase
            .from('disputes')
            .select('*, order:order_id(*)', { count: 'exact' });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (error) throw error;

        res.json({
            disputes: data,
            total: count || 0
        });
    } catch (error) {
        console.error('获取纠纷列表失败:', error);
        res.status(500).json({ error: '获取纠纷列表失败' });
    }
};

/**
 * 裁决纠纷 (Resolve Dispute)
 * action: 'refund' (退款给买家) | 'release' (放款给卖家)
 */
export const resolveDispute = async (req: AdminRequest, res: Response) => {
    try {
        const { disputeId, action, adminNote } = req.body;

        // 1. Fetch Dispute & Order
        const { data: dispute } = await supabase
            .from('disputes')
            .select('*, order:order_id(*)')
            .eq('id', disputeId)
            .single();

        if (!dispute || !dispute.order) {
            return res.status(404).json({ error: 'Dispute or Order not found' });
        }

        const order = dispute.order;
        const paymentIntentId = order.payment_intent_id;

        if (action === 'refund') {
            // A. Refund to Buyer
            // Assume full refund for simplicity
            await getStripe().refunds.create({
                payment_intent: paymentIntentId,
            });

            // Update DB
            await supabase.from('orders').update({ status: 'refunded' }).eq('id', order.id);
            await supabase.from('disputes').update({ status: 'resolved_refund', description: adminNote }).eq('id', disputeId);

        } else if (action === 'release') {
            // B. Release to Seller
            // Similar logic to confirmOrder in paymentController

            // Fetch seller connect ID
            const { data: seller } = await supabase
                .from('sellers')
                .select('stripe_connect_id')
                .eq('user_id', order.seller_id)
                .single();

            if (seller?.stripe_connect_id) {
                const amount = Math.round(order.amount * 100);
                const platformFee = Math.round(amount * 0.05);
                const transferAmount = amount - platformFee;

                await getStripe().transfers.create({
                    amount: transferAmount,
                    currency: order.currency.toLowerCase(),
                    destination: seller.stripe_connect_id,
                    metadata: { orderId: order.id, disputeId }
                });
            }

            // Update DB
            await supabase.from('orders').update({ status: 'completed' }).eq('id', order.id);
            await supabase.from('disputes').update({ status: 'resolved_release', description: adminNote }).eq('id', disputeId);

        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Log Action
        if (req.admin) {
            await logAdminAction(
                req.admin.id, req.admin.email,
                'resolve_dispute', 'dispute', disputeId,
                { action, adminNote }
            );
        }

        res.json({ success: true, action });

    } catch (error: any) {
        console.error('裁决失败:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * 标记订单为已人工打款 (Manual Payout)
 */
export const markOrderAsPaid = async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body; // Admin can optionally add a note (e.g. transaction ref)

        // 1. Check if order exists and is in correct state
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'completed_pending_payout') {
            return res.status(400).json({ error: 'Order is not pending manual payout' });
        }

        // 2. Update Order Status
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'completed',
                updated_at: new Date()
                // We could add a 'payout_reference' column later if needed, strictly storing in logs for now.
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // 3. Log Admin Action
        if (req.admin) {
            await logAdminAction(
                req.admin.id,
                req.admin.email,
                'manual_payout',
                'order',
                String(id),
                { notes, previous_status: 'completed_pending_payout' }
            );
        }

        res.json({ success: true });

    } catch (error: any) {
        console.error('标记订单已打款失败:', error);
        res.status(500).json({ error: error.message });
    }
};
