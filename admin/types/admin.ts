// 管理员后台类型定义

export interface AdminUser {
    id: string;
    email: string;
    role: 'admin' | 'super_admin';
    permissions?: string[];
}

export interface AdminStats {
    totalProducts: number;
    productsToday: number;
    activeProducts: number;
    totalUsers: number;
    totalMessages: number;
    messagesToday: number;
    totalConversations: number;
}

export interface CategoryStat {
    category: string;
    total_count: number;
    active_count: number;
    inactive_count: number;
    pending_count: number;
    promoted_count: number;
    today_count: number;
    week_count: number;
    avg_price: number;
    total_views: number;
}

export interface WeeklyTrend {
    date: string;
    products_count: number;
    total_views: number;
}

export interface AdminProduct {
    id: string;
    seller_id: string;
    seller_name: string;
    seller_email: string;
    seller_avatar: string | null;
    seller_verified: boolean;
    title: string;
    description: string;
    price: number;
    currency: string;
    images: string[];
    category: string;
    delivery_type: string;
    latitude: number;
    longitude: number;
    location_name: string;
    is_promoted: boolean;
    status: 'active' | 'inactive' | 'deleted' | 'pending_review';
    deleted_at: string | null;
    views_count: number;
    reported_count: number;
    created_at: string;
}

export interface AdminUserInfo {
    id: string;
    name: string;
    email: string;
    avatar: string;
    is_verified: boolean;
    product_count: number;
    conversation_count: number;
}

export interface AdminConversation {
    id: string;
    product_id: string;
    user1_id: string;
    user2_id: string;
    last_message_time: string;
    created_at: string;
    deleted_at: string | null;
    message_count?: number;
    product_title?: string;
    product_image?: string;
    buyer_email?: string;
    seller_email?: string;
}

export interface AdminMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_email?: string;
    text: string;
    content: string;
    is_read: boolean;
    timestamp: string;
    created_at: string;
    deleted_at: string | null;
    is_flagged: boolean;
    flag_reason: string | null;
}

export interface AdminLog {
    id: string;
    admin_id: string;
    admin_email: string;
    action_type: string;
    target_type: string;
    target_id: string;
    details: any;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}
