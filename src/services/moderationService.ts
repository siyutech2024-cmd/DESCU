import { api } from '@/lib/api/client';

export type ReportTargetType = 'user' | 'product' | 'message' | 'conversation';
export type ReportReason =
    | 'misinfo'
    | 'hate'
    | 'scam'
    | 'prohibited'
    | 'sensitive'
    | 'harassment'
    | 'spam'
    | 'other';

export interface ReportPayload {
    target_type: ReportTargetType;
    target_id: string;
    reason: ReportReason;
    description?: string;
}

export interface ReportResult {
    id: string;
    status: string;
    /** True when the same reporter already reported this target (200 instead of 201). */
    duplicate: boolean;
}

/** POST /api/reports */
export const submitReport = (payload: ReportPayload): Promise<ReportResult> =>
    api.post<ReportResult>('/api/reports', payload, { auth: 'required' });

/** POST /api/blocks — block another user. */
export const blockUser = (blockedId: string): Promise<void> =>
    api.post<void>('/api/blocks', { blocked_id: blockedId }, { auth: 'required' });

/** DELETE /api/blocks/:userId — unblock a user. */
export const unblockUser = (userId: string): Promise<void> =>
    api.delete<void>(`/api/blocks/${userId}`, { auth: 'required' });

/** GET /api/blocks — ids of the users the current user has blocked. */
export const getBlockedIds = async (): Promise<string[]> => {
    const data = await api.get<{ blocked_ids?: string[] }>('/api/blocks', { auth: 'required' });
    return data?.blocked_ids ?? [];
};
