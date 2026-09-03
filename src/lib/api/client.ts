import { supabase } from '@/services/supabase';
import { API_BASE_URL } from '@/services/apiConfig';

/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;

    constructor(status: number, message: string, body?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

export type AuthMode =
    /** Attach the Supabase access token; throw ApiError(401) when not signed in. */
    | 'required'
    /** Attach the token when available, otherwise call anonymously. */
    | 'optional'
    /** Never attach a token. */
    | 'none';

export interface ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** JSON-serialisable body. */
    body?: unknown;
    /** Query string parameters; null/undefined/'' values are dropped. */
    params?: Record<string, string | number | boolean | null | undefined>;
    auth?: AuthMode;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

const buildQuery = (params?: ApiRequestOptions['params']): string => {
    if (!params) return '';
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
};

/** Current Supabase access token, or null when signed out. */
export const getAccessToken = async (): Promise<string | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    } catch {
        return null;
    }
};

const extractErrorMessage = (status: number, body: unknown): string => {
    if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        const candidate = record.error ?? record.message;
        if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    return `Request failed with status ${status}`;
};

/**
 * Typed fetch wrapper for the DESCU API.
 *
 * - Prefixes `API_BASE_URL`
 * - Serialises JSON bodies
 * - Attaches the Supabase bearer token according to `auth`
 * - Throws `ApiError` for non-2xx responses (message taken from `{ error | message }`)
 * - Returns parsed JSON (or `undefined` for empty responses)
 */
export async function apiFetch<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params, auth = 'none', headers = {}, signal } = options;

    const requestHeaders: Record<string, string> = { ...headers };

    if (auth !== 'none') {
        const token = await getAccessToken();
        if (token) {
            requestHeaders.Authorization = `Bearer ${token}`;
        } else if (auth === 'required') {
            throw new ApiError(401, 'Authentication required');
        }
    }

    let payload: BodyInit | undefined;
    if (body !== undefined) {
        requestHeaders['Content-Type'] = requestHeaders['Content-Type'] ?? 'application/json';
        payload = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${path}${buildQuery(params)}`, {
        method,
        headers: requestHeaders,
        body: payload,
        signal,
    });

    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        throw new ApiError(response.status, extractErrorMessage(response.status, data), data);
    }

    return data as T;
}

export const api = {
    get: <T = unknown>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
        apiFetch<T>(path, { ...options, method: 'GET' }),
    post: <T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
        apiFetch<T>(path, { ...options, method: 'POST', body }),
    put: <T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
        apiFetch<T>(path, { ...options, method: 'PUT', body }),
    patch: <T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
        apiFetch<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T = unknown>(path: string, options?: Omit<ApiRequestOptions, 'method'>) =>
        apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
