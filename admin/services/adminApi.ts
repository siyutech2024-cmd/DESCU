// 管理员后台API服务

import { supabase } from '../../services/sp';
import * as AdminTypes from '../types/admin';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 获取认证Token
const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
};

// 通用请求函数
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<AdminTypes.ApiResponse<T>> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.error || data.message || '请求失败' };
        }

        return { data };
    } catch (error) {
        console.error('API请求错误:', error);
        return { error: '网络错误' };
    }
}

// ==================== 认证 ====================

export const adminApi = {
    // 获取当前管理员信息
    getAdminInfo: async () => {
        return apiRequest<AdminTypes.AdminUser>('/api/admin/auth/me');
    },

    // ==================== 仪表板 ====================

    getDashboardStats: async () => {
        return apiRequest<{
            stats: AdminTypes.AdminStats;
            categoryStats: AdminTypes.CategoryStat[];
            weeklyTrend: AdminTypes.WeeklyTrend[];
            recentProducts: AdminTypes.AdminProduct[];
        }>('/api/admin/dashboard/stats');
    },

    // ==================== 商品管理 ====================

    getProducts: async (params?: {
        page?: number;
        limit?: number;
        search?: string;
        category?: string;
        status?: string;
        is_promoted?: string;
        seller_id?: string;
        include_deleted?: string;
    }) => {
        const queryString = new URLSearchParams(params as any).toString();
        return apiRequest<{
            products: AdminTypes.AdminProduct[];
            pagination: AdminTypes.Pagination;
        }>(`/api/admin/products?${queryString}`);
    },

    getProduct: async (id: string) => {
        return apiRequest<{
            product: AdminTypes.AdminProduct;
            conversationCount: number;
        }>(`/api/admin/products/${id}`);
    },

    updateProduct: async (id: string, updates: Partial<AdminTypes.AdminProduct>) => {
        return apiRequest<{ product: AdminTypes.AdminProduct }>(
            `/api/admin/products/${id}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );
    },

    deleteProduct: async (id: string) => {
        return apiRequest(`/api/admin/products/${id}`, {
            method: 'DELETE',
        });
    },

    restoreProduct: async (id: string) => {
        return apiRequest(`/api/admin/products/${id}/restore`, {
            method: 'POST',
        });
    },

    updateProductStatus: async (id: string, status: string) => {
        return apiRequest(`/api/admin/products/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    },

    updateProductPromotion: async (id: string, is_promoted: boolean) => {
        return apiRequest(`/api/admin/products/${id}/promote`, {
            method: 'PATCH',
            body: JSON.stringify({ is_promoted }),
        });
    },

    batchUpdateProducts: async (product_ids: string[], action: string, data?: any) => {
        return apiRequest(`/api/admin/products/batch`, {
            method: 'POST',
            body: JSON.stringify({ product_ids, action, data }),
        });
    },

    // ==================== 用户管理 ====================

    getUsers: async (params?: {
        page?: number;
        limit?: number;
        search?: string;
        is_verified?: string;
    }) => {
        const queryString = new URLSearchParams(params as any).toString();
        return apiRequest<{
            users: AdminTypes.AdminUserInfo[];
            pagination: AdminTypes.Pagination;
        }>(`/api/admin/users?${queryString}`);
    },

    getUser: async (id: string) => {
        return apiRequest<{
            user: AdminTypes.AdminUserInfo;
            products: AdminTypes.AdminProduct[];
            conversations: AdminTypes.AdminConversation[];
        }>(`/api/admin/users/${id}`);
    },

    updateUserVerification: async (id: string, is_verified: boolean) => {
        return apiRequest(`/api/admin/users/${id}/verify`, {
            method: 'PATCH',
            body: JSON.stringify({ is_verified }),
        });
    },

    deleteUser: async (id: string, hard_delete: boolean = false) => {
        return apiRequest(`/api/admin/users/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ hard_delete }),
        });
    },

    // ==================== 消息管理 ====================

    getConversations: async (params?: {
        page?: number;
        limit?: number;
        product_id?: string;
        user_id?: string;
        include_deleted?: string;
    }) => {
        const queryString = new URLSearchParams(params as any).toString();
        return apiRequest<{
            conversations: AdminTypes.AdminConversation[];
            pagination: AdminTypes.Pagination;
        }>(`/api/admin/conversations?${queryString}`);
    },

    getConversation: async (id: string) => {
        return apiRequest<{
            conversation: AdminTypes.AdminConversation & { product: AdminTypes.AdminProduct };
            messages: AdminTypes.AdminMessage[];
        }>(`/api/admin/conversations/${id}`);
    },

    deleteConversation: async (id: string, hard_delete: boolean = false) => {
        return apiRequest(`/api/admin/conversations/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ hard_delete }),
        });
    },

    deleteMessage: async (id: string, hard_delete: boolean = false) => {
        return apiRequest(`/api/admin/messages/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ hard_delete }),
        });
    },

    flagMessage: async (id: string, is_flagged: boolean, flag_reason?: string) => {
        return apiRequest(`/api/admin/messages/${id}/flag`, {
            method: 'PATCH',
            body: JSON.stringify({ is_flagged, flag_reason }),
        });
    },

    // ==================== 操作日志 ====================

    getAdminLogs: async (params?: {
        page?: number;
        limit?: number;
        action_type?: string;
        target_type?: string;
        admin_id?: string;
    }) => {
        const queryString = new URLSearchParams(params as any).toString();
        return apiRequest<{
            logs: AdminTypes.AdminLog[];
            pagination: AdminTypes.Pagination;
        }>(`/api/admin/logs?${queryString}`);
    },
};
