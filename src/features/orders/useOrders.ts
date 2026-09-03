import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Order } from '@/types';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/features/auth';

const ORDERS_POLL_MS = 30_000;
const CLOSED_STATUSES: Order['status'][] = ['completed', 'cancelled'];

/** The signed-in user's orders (as buyer or seller), polled every 30 s. */
export const useOrders = () => {
    const { user } = useAuth();
    const userId = user?.id ?? '';

    const query = useQuery({
        queryKey: queryKeys.orders(userId),
        enabled: !!userId,
        refetchInterval: ORDERS_POLL_MS,
        queryFn: async () => {
            const data = await api.get<{ orders?: Order[] }>('/api/orders', { auth: 'required' });
            return data.orders ?? [];
        },
    });

    const orders = useMemo(() => (userId ? query.data ?? [] : []), [query.data, userId]);
    const pendingOrderCount = useMemo(() => orders.filter(o => !CLOSED_STATUSES.includes(o.status)).length, [orders]);

    return { orders, pendingOrderCount, isLoading: query.isLoading, refetch: query.refetch };
};
