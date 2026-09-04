import { AdminRequest } from '../middleware/adminAuth.js';
import { supabase } from '../db/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '../lib/stripe.js';
import { canTransition, isOrderStatus, isPaymentSettled } from '../domain/orders.js';
import { normalizeCategory } from '../domain/categories.js';

/** Rows of the admin_product_stats view keyed by canonical category (the view groups by raw spelling). */
const mergeCategoryStats = (rows: any[]): any[] => {
    const merged = new Map<string, any>();
    for (const row of rows) {
        const key = normalizeCategory(row.category);
        const acc = merged.get(key) ?? { ...row, category: key, count: 0, active_count: 0, inactive_count: 0, pending_count: 0, promoted_count: 0, today_count: 0, week_count: 0 };
        for (const k of ['count', 'active_count', 'inactive_count', 'pending_count', 'promoted_count', 'today_count', 'week_count']) {
            acc[k] = (Number(acc[k]) || 0) + (Number(row[k]) || 0);
        }
        merged.set(key, acc);
    }
    return [...merged.values()].sort((a, b) => b.count - a.count);
};
import { HttpError, asyncHandler, conflict, notFound, parseBody, parseParams, parseQuery, unauthorized } from '../lib/http.js';
import { releaseEscrow } from '../services/escrowReleaseService.js';
import { completeManualPayout } from '../services/payoutService.js';
import { transitionOrder } from '../services/orderTransitionService.js';
import {
    AdminDisputesQuerySchema,
    AdminIdParamSchema,
    AdminLogsQuerySchema,
    AdminOrdersQuerySchema,
    BatchUpdateSettingsSchema,
    MarkOrderPaidSchema,
    ReportsQuerySchema,
    ResolveDisputeSchema,
    UpdateSettingSchema,
} from '../schemas/adminGeneral.js';

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
 * Aggregate: every sub-query is allowed to fail individually (views / RPCs may not exist yet),
 * the response falls back to zeros and reports the errors under `_debug`.
 */
export const getDashboardStats = asyncHandler<AdminRequest>(async (_req, res) => {
    const todayStr = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const weekAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create a dedicated Admin Client to ensure we bypass RLS
    const adminUrl = process.env.SUPABASE_URL;
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminUrl || !adminKey) {
        throw new HttpError(500, 'Server configuration error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const adminClient = createClient(adminUrl, adminKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('[Dashboard] Using Admin Client with Service Role Key');

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
        recentProducts,
        // Fallback: raw counts without filters
        rawProductCount,
        rawUserCount
    ] = await Promise.all([
        // 1. Total Products (try with deleted_at filter, fallback handled below)
        adminClient.from('products').select('*', { count: 'exact', head: true }),
        // 2. Products Today
        adminClient.from('products').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
        // 3. Active Products (status might not exist, so we try without filter as well)
        adminClient.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        // 4. Total Users (Detailed count via RPC)
        adminClient.rpc('get_total_users'),
        // 5. Total Messages
        adminClient.from('messages').select('*', { count: 'exact', head: true }),
        // 6. Messages Today
        adminClient.from('messages').select('*', { count: 'exact', head: true }).gte('timestamp', todayStr),
        // 7. Total Conversations
        adminClient.from('conversations').select('*', { count: 'exact', head: true }),
        // 8. Category Stats (view might not exist)
        adminClient.from('admin_product_stats').select('*'),
        // 9. Weekly Trend (view might not exist)
        adminClient.from('admin_daily_stats').select('*').gte('date', weekAgoStr).order('date', { ascending: true }),
        // 10. Recent Products (simple query without deleted_at filter)
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
            .order('created_at', { ascending: false })
            .limit(10),
        // 11. Fallback: raw product count
        adminClient.from('products').select('id', { count: 'exact', head: true }),
        // 12. Fallback: Try direct user count on products
        adminClient.from('products').select('seller_id')
    ]);

    // Debug logging for all queries
    console.log('[Dashboard] Query Results:');
    console.log('  - adminUrl:', adminUrl ? 'SET' : 'MISSING');
    console.log('  - adminKey:', adminKey ? 'SET (first 10 chars: ' + adminKey.substring(0, 10) + '...)' : 'MISSING');
    console.log('  - productStats:', { count: productStats.count, error: productStats.error?.message });
    console.log('  - rawProductCount:', { count: rawProductCount.count, error: rawProductCount.error?.message });
    console.log('  - productsToday:', { count: productsToday.count, error: productsToday.error?.message });
    console.log('  - productsActive:', { count: productsActive.count, error: productsActive.error?.message });
    console.log('  - usersStats RPC:', { data: usersStats.data, error: usersStats.error?.message });
    console.log('  - rawUserCount (sellers):', { count: rawUserCount.data?.length, uniqueSellers: new Set(rawUserCount.data?.map((p: any) => p.seller_id)).size });
    console.log('  - messageStats:', { count: messageStats.count, error: messageStats.error?.message });
    console.log('  - messagesToday:', { count: messagesToday.count, error: messagesToday.error?.message });
    console.log('  - conversationStats:', { count: conversationStats.count, error: conversationStats.error?.message });
    console.log('  - categoryStats:', { data: categoryStats.data?.length, error: categoryStats.error?.message });
    console.log('  - weeklyTrend:', { data: weeklyTrend.data?.length, error: weeklyTrend.error?.message });
    console.log('  - recentProducts:', { data: recentProducts.data?.length, error: recentProducts.error?.message });

    // Calculate fallback user count from seller_id
    const uniqueSellers = rawUserCount.data ? new Set(rawUserCount.data.map((p: any) => p.seller_id)).size : 0;
    const finalUserCount = usersStats.data || uniqueSellers || 0;
    const finalProductCount = productStats.count ?? rawProductCount.count ?? 0;

    // Check for critical errors
    if (productStats.error) console.error('Error fetching product stats:', productStats.error);
    if (usersStats.error) console.error('Error fetching user stats via RPC:', usersStats.error);

    res.json({
        stats: {
            totalProducts: finalProductCount,
            productsToday: productsToday.count || 0,
            activeProducts: productsActive.count || finalProductCount, // Fallback: if no status column, use total
            totalUsers: finalUserCount,
            totalMessages: messageStats.count || 0,
            messagesToday: messagesToday.count || 0,
            totalConversations: conversationStats.count || 0
        },
        categoryStats: mergeCategoryStats(categoryStats.data || []),
        weeklyTrend: weeklyTrend.data || [],
        recentProducts: recentProducts.data || [],
        // Debug info (remove in production)
        _debug: {
            hasServiceRoleKey: !!adminKey,
            rpcError: usersStats.error?.message,
            productQueryError: productStats.error?.message
        }
    });
});

/**
 * 获取管理员信息
 */
export const getAdminInfo = asyncHandler<AdminRequest>(async (req, res) => {
    if (!req.admin) throw unauthorized('未授权');

    res.json({
        id: req.admin.id,
        email: req.admin.email,
        role: req.admin.role,
        permissions: req.admin.permissions || []
    });
});

/**
 * 获取操作日志列表
 */
export const getAdminLogs = asyncHandler<AdminRequest>(async (req, res) => {
    const { page, limit, action_type, target_type, admin_id } = parseQuery(AdminLogsQuerySchema, req.query);
    const offset = (page - 1) * limit;

    let query = supabase
        .from('admin_logs')
        .select('*', { count: 'exact' });

    // 应用筛选
    if (action_type) query = query.eq('action_type', action_type);
    if (target_type) query = query.eq('target_type', target_type);
    if (admin_id) query = query.eq('admin_id', admin_id);

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({
        logs: data,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    });
});

const TIME_RANGE_MS: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
};

/**
 * 获取数据报表统计
 * Aggregate: each sub-query's error is ignored on purpose (RPCs may not be deployed); missing data → [].
 */
export const getReportsData = asyncHandler<AdminRequest>(async (req, res) => {
    const { timeRange } = parseQuery(ReportsQuerySchema, req.query);

    // 计算时间范围
    const now = new Date();
    const startDate = new Date(now.getTime() - (TIME_RANGE_MS[timeRange] ?? TIME_RANGE_MS['7d']));

    // 获取销售趋势（按日期统计商品数量）
    const { data: salesTrend } = await supabase
        .rpc('get_sales_trend', {
            start_date: startDate.toISOString(),
            end_date: now.toISOString()
        })
        .order('date', { ascending: true });

    // 获取用户增长趋势
    const { data: userGrowth } = await supabase
        .rpc('get_user_growth', {
            start_date: startDate.toISOString(),
            end_date: now.toISOString()
        })
        .order('date', { ascending: true });

    // 获取分类统计
    const { data: categoryStats } = await supabase
        .from('products')
        .select('category')
        .is('deleted_at', null);

    // 统计每个分类的数量
    const categoryCounts: Record<string, number> = {};
    categoryStats?.forEach(item => {
        // Stored spellings vary (Other/other, electronics/Electronics, AI paths) — report on the canonical one.
        const category = normalizeCategory(item.category);
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const categoryDistribution = Object.entries(categoryCounts).map(([name, count]) => ({
        name,
        count,
        percentage: categoryStats ? Math.round((count / categoryStats.length) * 100) : 0
    }));

    // 获取热门商品 Top 10
    const { data: topProducts } = await supabase
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
    const { data: activeUsers } = await supabase
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
});

/**
 * 获取系统设置
 */
export const getSystemSettings = asyncHandler<AdminRequest>(async (_req, res) => {
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
});

/**
 * 更新系统设置
 */
export const updateSystemSettings = asyncHandler<AdminRequest>(async (req, res) => {
    const { setting_key, setting_value, description } = parseBody(UpdateSettingSchema, req.body);

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
});

/**
 * 批量更新系统设置
 */
export const batchUpdateSettings = asyncHandler<AdminRequest>(async (req, res) => {
    const { settings } = parseBody(BatchUpdateSettingsSchema, req.body);

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
});

/**
 * 获取订单列表 (Transactions)
 */
export const getAdminOrders = asyncHandler<AdminRequest>(async (req, res) => {
    const { page, limit, status } = parseQuery(AdminOrdersQuerySchema, req.query);
    const offset = (page - 1) * limit;

    // 1. Fetch Orders (Raw) - Only join products (public schema)
    let query = supabase
        .from('orders')
        .select('*, products(title, images)', { count: 'exact' });

    if (status) query = query.eq('status', status);

    const { data: orders, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) throw error;

    if (!orders || orders.length === 0) {
        return res.json({
            orders: [],
            total: count || 0,
            page,
            totalPages: 0
        });
    }

    // 2. Collect User IDs
    const userIds = new Set<string>();
    orders.forEach(o => {
        if (o.buyer_id) userIds.add(o.buyer_id);
        if (o.seller_id) userIds.add(o.seller_id);
    });

    // 3. One query on public.users (mirrors auth.users) instead of one auth.admin call per user.
    const { data: userRows, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', Array.from(userIds));
    if (usersError) throw usersError;
    const userMap = new Map<string, { name: string | null; email: string | null }>(
        (userRows || []).map((u: any) => [u.id, { name: u.name ?? null, email: u.email ?? null }])
    );

    // 4. Enrich Orders
    const enrichedOrders = orders.map(o => ({
        ...o,
        buyer: { email: userMap.get(o.buyer_id)?.email || 'Unknown', name: userMap.get(o.buyer_id)?.name ?? null },
        seller: { email: userMap.get(o.seller_id)?.email || 'Unknown', name: userMap.get(o.seller_id)?.name ?? null }
    }));

    res.json({
        orders: enrichedOrders,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit)
    });
});

/**
 * 获取纠纷列表 (Disputes)
 */
export const getAdminDisputes = asyncHandler<AdminRequest>(async (req, res) => {
    const { page, limit, status } = parseQuery(AdminDisputesQuerySchema, req.query);
    const offset = (page - 1) * limit;

    let query = supabase
        .from('disputes')
        .select('*, order:order_id(*)', { count: 'exact' });

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({
        disputes: data,
        total: count || 0
    });
});

/**
 * 裁决纠纷 (Resolve Dispute)
 * action: 'refund' (退款给买家) | 'release' (放款给卖家)
 */
export const resolveDispute = asyncHandler<AdminRequest>(async (req, res) => {
    const { disputeId, action, adminNote } = parseBody(ResolveDisputeSchema, req.body);

    // 1. Fetch Dispute & Order
    const { data: dispute, error: disputeError } = await supabase
        .from('disputes')
        .select('*, order:order_id(*)')
        .eq('id', disputeId)
        .maybeSingle();
    if (disputeError) throw disputeError;
    if (!dispute || !dispute.order) throw notFound('Dispute or Order not found');
    if (dispute.status !== 'open') throw conflict(`Dispute already ${dispute.status}`);
    // The ruling must be representable in the state graph *before* any money moves.
    const target = action === 'refund' ? 'refunded' : 'completed';
    if (!isOrderStatus(dispute.order.status) || !canTransition(dispute.order.status, target)) {
        throw conflict(`Order is in status "${dispute.order.status}" and cannot be ${target}; reconcile manually`);
    }

    // 2. Claim the dispute first so a double click / concurrent admin cannot move money twice.
    const resolvedStatus = action === 'refund' ? 'resolved_refund' : 'resolved_release';
    const { data: claimed, error: claimError } = await supabase
        .from('disputes')
        .update({ status: 'resolving', admin_note: adminNote ?? null })
        .eq('id', disputeId)
        .eq('status', 'open')
        .select('id');
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) throw conflict('Dispute is already being resolved');

    const order = dispute.order;
    // Current schema: stripe_payment_intent_id (legacy rows may still carry payment_intent_id)
    const paymentIntentId: string | null = order.stripe_payment_intent_id || order.payment_intent_id || null;
    // Same settlement rule as every other endpoint (legacy rows have payment_captured = null).
    const isOnline = order.payment_method === 'online' && isPaymentSettled(order);

    try {
        if (action === 'refund') {
            if (isOnline) {
                if (order.transferred_to_seller) throw new Error('Funds were already transferred to the seller; refund manually');
                if (!paymentIntentId) throw new Error('Order has no payment intent to refund');
                // Stripe caches the *result* of an idempotency key (including failures) for 24h,
                // so each retry after a recorded failure gets a fresh key.
                const { count: failedAttempts } = await supabase
                    .from('order_timeline')
                    .select('id', { count: 'exact', head: true })
                    .eq('order_id', order.id)
                    .eq('event_type', 'dispute_refund_failed');
                const attempt = failedAttempts ?? 0;
                try {
                    await getStripe().refunds.create(
                        { payment_intent: paymentIntentId, metadata: { order_id: order.id, dispute_id: disputeId } },
                        { idempotencyKey: `dispute_refund_${disputeId}_${attempt}` }
                    );
                } catch (refundError: any) {
                    await supabase.from('order_timeline').insert({
                        order_id: order.id, event_type: 'dispute_refund_failed',
                        description: `Refund failed: ${refundError?.message ?? 'unknown error'}`,
                        created_by: req.admin?.id ?? null, metadata: { dispute_id: disputeId, attempt },
                    });
                    throw refundError;
                }
            }
            const refunded = await transitionOrder({
                orderId: order.id,
                from: order.status,
                to: 'refunded',
                patch: { escrow_status: isOnline ? 'refunded' : order.escrow_status },
                select: 'id, product_id',
            });
            if (!refunded.ok) throw new Error(`Order changed state during refund (${refunded.error}); reconcile manually`);
            // The item goes back on sale once the buyer has been refunded.
            if (refunded.order.product_id) {
                await supabase.from('products').update({ status: 'active' }).eq('id', refunded.order.product_id).eq('status', 'sold');
            }
        } else {
            // Release to the seller through the shared escrow path (transfer / manual payout queue / cash).
            const outcome = await releaseEscrow(order, {
                actorId: req.admin?.id ?? null,
                source: 'dispute',
                description: adminNote || 'Dispute resolved in favour of the seller',
            });
            if (!outcome.ok) throw new Error(outcome.error);
        }
    } catch (moneyError: any) {
        // Money movement failed: reopen the dispute so it can be retried, then surface a generic
        // failure (the Stripe / state-machine detail stays in the log, never in the response).
        await supabase.from('disputes').update({ status: 'open' }).eq('id', disputeId).eq('status', 'resolving');
        console.error('裁决失败:', moneyError);
        throw new HttpError(500, 'Failed to resolve dispute');
    }

    await supabase.from('disputes').update({ status: resolvedStatus }).eq('id', disputeId);
    await supabase.from('order_timeline').insert({
        order_id: order.id,
        event_type: action === 'refund' ? 'dispute_refunded' : 'dispute_released',
        description: adminNote || `Dispute resolved: ${action}`,
        created_by: req.admin?.id ?? null,
        metadata: { dispute_id: disputeId, action },
    });

    if (req.admin) {
        await logAdminAction(req.admin.id, req.admin.email, 'resolve_dispute', 'dispute', disputeId, { action, adminNote });
    }

    res.json({ success: true, action });
});

/**
 * 标记订单为已人工打款 (Manual Payout)
 * Same action as POST /api/admin/payouts/:orderId/complete — both go through
 * payoutService.completeManualPayout so there is a single state transition.
 */
export const markOrderAsPaid = asyncHandler<AdminRequest>(async (req, res) => {
    const { id } = parseParams(AdminIdParamSchema, req.params);
    const { notes, reference } = parseBody(MarkOrderPaidSchema, req.body); // Admin can optionally add a note / transaction ref

    const outcome = await completeManualPayout({ orderId: id, adminId: req.admin?.id ?? null, reference, notes });
    if (!outcome.ok) throw new HttpError(outcome.code, outcome.error);

    if (req.admin) {
        await logAdminAction(
            req.admin.id,
            req.admin.email,
            'manual_payout',
            'order',
            id,
            { notes, reference: outcome.order.payout_reference, previous_status: 'completed_pending_payout' },
            req.ip,
            req.get('user-agent')
        );
    }

    res.json({ success: true, order: outcome.order });
});
