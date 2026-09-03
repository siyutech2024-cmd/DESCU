// API 配置 - 根据环境自动选择 API 基础 URL
const getApiBaseUrl = (): string => {
    // 1. Priority: Explicit Environment Variable (works for Dev & Prod)
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // 2. Production Fallback (if env var missing)
    if (import.meta.env.PROD) {
        // Default to relative path on Vercel (same domain)
        return '';
    }

    // 3. Development Fallback (Proxy to localhost:3000 via vite.config.ts)
    return '';
};

export const API_BASE_URL = getApiBaseUrl();

// API 端点
export const API_ENDPOINTS = {
    ANALYZE: `${API_BASE_URL}/api/analyze`,
    PRODUCTS: `${API_BASE_URL}/api/products`,
    CONVERSATIONS: `${API_BASE_URL}/api/conversations`,
    MESSAGES: `${API_BASE_URL}/api/messages`,
} as const;

// 辅助函数：构建完整的 API URL
export const buildApiUrl = (path: string): string => {
    return `${API_BASE_URL}${path}`;
};
