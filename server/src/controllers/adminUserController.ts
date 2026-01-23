import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth.js';
import { supabase } from '../db/supabase.js';
import { logAdminAction } from './adminController.js';

/**
 * 获取用户列表
 */
/**
 * 获取用户列表
 * 改为从 Auth 获取所有用户，以确保显示未发布商品的新用户
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

        // 1. 获取 Auth 用户列表 (目前只能获取所有然后内存分页，因为Auth API搜索能力有限)
        // 注意：生产环境如果用户量巨大，这里应该改用 SQL 视图或同步表
        console.log('Fetching users from Supabase Auth admin API...');
        const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers({
            perPage: 1000 // 临时方案：获取前1000个用户进行处理
        });

        if (authError) {
            console.error('Supabase Auth API Error:', authError);
            throw authError;
        }

        console.log(`Successfully fetched ${authUsers?.length} users from Auth API.`);

        // 2. 内存处理：搜索、筛选
        let processedUsers = authUsers.map(u => ({
            id: u.id,
            email: u.email,
            name: u.user_metadata?.full_name || u.user_metadata?.name || 'Unknown',
            avatar: u.user_metadata?.avatar_url || '',
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at
        }));

        // 搜索
        if (search) {
            const lowerSearch = String(search).toLowerCase();
            processedUsers = processedUsers.filter(u =>
                (u.email?.toLowerCase() || '').includes(lowerSearch) ||
                (u.name?.toLowerCase() || '').includes(lowerSearch)
            );
        }

        // 日期筛选
        if (start_date && start_date !== 'undefined') {
            const start = new Date(String(start_date)).getTime();
            processedUsers = processedUsers.filter(u => new Date(u.created_at).getTime() >= start);
        }
        if (end_date && end_date !== 'undefined') {
            const end = new Date(String(end_date));
            end.setHours(23, 59, 59, 999);
            processedUsers = processedUsers.filter(u => new Date(u.created_at).getTime() <= end.getTime());
        }

        // 3. 获取附加信息 (商品数、认证状态)
        // 这一步我们需要对筛选后的用户查询其商品信息
        // 为了性能，我们只对当前页的用户详细查询？
        // 不，有一个 is_verified 筛选依赖这些信息，所以必须先获取信息

        // 优化：批量查询所有相关用户的 stats
        const userIds = processedUsers.map(u => u.id);

        const { data: userStats, error: statsError } = await supabase
            .from('products')
            .select('seller_id, seller_verified, id');

        // 聚合统计
        const statsMap = new Map<string, { verified: boolean, productCount: number }>();

        (userStats || []).forEach(p => {
            const current = statsMap.get(p.seller_id) || { verified: false, productCount: 0 };
            // 只要有一个商品是 verified，用户就算 verified (或者取最新的 status，这里简化处理)
            // 实际上我们应该查 distinct seller_verified，但这里我们假设一致
            if (p.seller_verified) current.verified = true;
            current.productCount++;
            statsMap.set(p.seller_id, current);
        });

        // 合并信息
        let finalUsers = processedUsers.map(u => {
            const stats = statsMap.get(u.id);
            return {
                ...u,
                is_verified: stats?.verified || false,
                product_count: stats?.productCount || 0,
                conversation_count: 0 // 暂时忽略对话数，为了性能优化，如果需要可以再查
            };
        });

        // 认证筛选
        if (is_verified !== undefined && is_verified !== 'undefined') {
            const wantVerified = is_verified === 'true';
            finalUsers = finalUsers.filter(u => u.is_verified === wantVerified);
        }

        // 4. 排序
        finalUsers.sort((a, b) => {
            let valA, valB;
            if (sort_by === 'product_count') {
                valA = a.product_count;
                valB = b.product_count;
            } else {
                // created_at
                valA = a.created_at;
                valB = b.created_at;
            }

            if (valA < valB) return sort_order === 'asc' ? -1 : 1;
            if (valA > valB) return sort_order === 'asc' ? 1 : -1;
            return 0;
        });

        // 5. 分页
        const total = finalUsers.length;
        const offset = (Number(page) - 1) * Number(limit);
        const paginatedUsers = finalUsers.slice(offset, offset + Number(limit));

        // 补充对话数量 (仅对当前页)
        const paginatedIds = paginatedUsers.map(u => u.id);
        if (paginatedIds.length > 0) {
            const { data: convData } = await supabase
                .from('conversations')
                .select('user1_id, user2_id')
                .or(`user1_id.in.(${paginatedIds.join(',')}),user2_id.in.(${paginatedIds.join(',')})`);

            const convCounts = new Map<string, number>();
            (convData || []).forEach(c => {
                if (paginatedIds.includes(c.user1_id)) convCounts.set(c.user1_id, (convCounts.get(c.user1_id) || 0) + 1);
                if (paginatedIds.includes(c.user2_id)) convCounts.set(c.user2_id, (convCounts.get(c.user2_id) || 0) + 1);
            });

            paginatedUsers.forEach(u => {
                u.conversation_count = convCounts.get(u.id) || 0;
            });
        }

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
            String(id),
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
            String(id),
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
