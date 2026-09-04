import { api } from '@/lib/api/client';

/**
 * The signed-in user's favourite product ids.
 * `userId` is kept for call-site compatibility; the API derives the user from the bearer token.
 * Returns `[]` on failure (matches the previous direct-table behaviour).
 */
export const getFavorites = async (_userId: string): Promise<string[]> => {
    try {
        const data = await api.get<{ productIds?: string[] }>('/api/users/favorites', { auth: 'required' });
        return Array.isArray(data?.productIds) ? data.productIds : [];
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return [];
    }
};

/** Toggle a favourite; resolves `true` when the product is now favourited, `false` when removed. Throws on failure. */
export const toggleFavorite = async (_userId: string, productId: string): Promise<boolean> => {
    const data = await api.post<{ favorited: boolean }>(
        `/api/users/favorites/${encodeURIComponent(productId)}/toggle`,
        undefined,
        { auth: 'required' }
    );
    return !!data?.favorited;
};
