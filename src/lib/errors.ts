import { ApiError } from './api/client';

/**
 * Supabase and fetch can reject with AbortError during auth/language transitions.
 * These are harmless and should be ignored rather than surfaced to the user.
 */
export const isAbortError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const e = error as { name?: string; message?: string };
    return e.name === 'AbortError' || (typeof e.message === 'string' && e.message.includes('aborted'));
};

/** Best-effort human readable message for any thrown value. */
export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message || fallback;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        if (typeof record.message === 'string') return record.message;
        if (typeof record.error === 'string') return record.error;
    }
    return fallback;
};

export const isUnauthorized = (error: unknown): boolean =>
    error instanceof ApiError && error.status === 401;
