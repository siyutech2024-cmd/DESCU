// API 配置 - 根据环境自动选择 API 基础 URL
const getApiBaseUrl = (): string => {
    // 生产环境
    if (import.meta.env.PROD) {
        // 如果设置了自定义 API URL，使用它
        if (import.meta.env.VITE_API_URL) {
            return import.meta.env.VITE_API_URL;
        }
        // Fallback: Use known production backend if env var is missing
        return 'https://descu-api.up.railway.app';
    }

    // 开发环境 - 使用 Vite 代理
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
