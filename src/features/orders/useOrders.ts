import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Order } from '@/types';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/features/auth';
import { requiresAction } from './orderActions';

const ORDERS_POLL_MS = 30_000;
const CLOSED_STATUSES: Order['status'][] = ['completed', 'completed_pending_payout', 'cancelled', 'refunded'];

/** The signed-in user's orders (as buyer or seller), polled every 30 s while the tab is visible. */
export const useOrders = () => {
    const { user } = useAuth();
    const userId = user?.id ?? '';

    const query = useQuery({
        queryKey: queryKeys.orders(userId),
        enabled: !!userId,
        refetchInterval: ORDERS_POLL_MS,
        refetchIntervalInBackground: false,
        queryFn: async () => {
            const data = await api.get<{ orders?: Order[] }>('/api/orders', { params: { limit: 200 }, auth: 'required' });
            return data.orders ?? [];
        },
    });

    const orders = useMemo(() => (userId ? query.data ?? [] : []), [query.data, userId]);
    /** All orders that are not closed — informational, not a to-do count. */
    const pendingOrderCount = useMemo(() => orders.filter(o => !CLOSED_STATUSES.includes(o.status)).length, [orders]);
    /** Orders waiting on the signed-in user (drives the bottom-nav badge). */
    const actionRequiredCount = useMemo(
        () => (userId ? orders.filter(o => requiresAction(o, userId)).length : 0),
        [orders, userId]
    );

    return { orders, pendingOrderCount, actionRequiredCount, isLoading: query.isLoading, refetch: query.refetch };
};
