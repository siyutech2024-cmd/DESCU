import { QueryClient } from '@tanstack/react-query';
import { isAbortError } from './errors';

/**
 * Shared React Query client.
 * Query keys are centralised in `queryKeys` so invalidation stays consistent.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => !isAbortError(error) && failureCount < 1,
        },
        mutations: {
            retry: 0,
        },
    },
});

export const queryKeys = {
    products: {
        all: ['products'] as const,
        list: (language: string) => ['products', 'list', language] as const,
        detail: (id: string, language: string) => ['products', 'detail', id, language] as const,
        bySeller: (sellerId: string) => ['products', 'seller', sellerId] as const,
        /** The signed-in seller's own listings, all statuses (profile page). */
        mine: (userId: string) => ['products', 'mine', userId] as const,
    },
    favorites: (userId: string) => ['favorites', userId] as const,
    conversations: (userId: string) => ['conversations', userId] as const,
    orders: (userId: string) => ['orders', userId] as const,
    ratings: (userId: string) => ['ratings', userId] as const,
    publicUser: (userId: string) => ['users', 'public', userId] as const,
    payouts: (userId: string) => ['payouts', userId] as const,
} as const;
