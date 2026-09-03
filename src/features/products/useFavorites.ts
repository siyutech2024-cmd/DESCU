import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product } from '@/types';
import { useLanguage } from '@/i18n';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';
import { getFavorites, toggleFavorite } from '@/services/favoriteService';
import { useAuth } from '@/features/auth';

/** The signed-in user's favourite product ids with optimistic toggling. */
export const useFavorites = () => {
    const { user, openLoginModal } = useAuth();
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const userId = user?.id ?? '';
    const queryKey = queryKeys.favorites(userId);

    const query = useQuery({
        queryKey,
        enabled: !!userId,
        queryFn: () => getFavorites(userId),
    });

    const favorites = useMemo(() => new Set(query.data ?? []), [query.data]);

    const mutation = useMutation({
        mutationFn: (productId: string) => toggleFavorite(userId, productId),
        onMutate: async (productId) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<string[]>(queryKey) ?? [];
            const wasFavorite = previous.includes(productId);
            queryClient.setQueryData<string[]>(queryKey, wasFavorite ? previous.filter(id => id !== productId) : [...previous, productId]);
            return { previous, wasFavorite };
        },
        onSuccess: (_result, _productId, context) => {
            notify.success(context?.wasFavorite ? t('toast.favorite_removed') : t('toast.favorite_added'));
        },
        onError: (error, _productId, context) => {
            console.error('[favorites] toggle failed:', error);
            if (context) queryClient.setQueryData(queryKey, context.previous);
            notify.error(t('toast.favorite_update_failed'));
        },
    });

    const toggle = useCallback(
        (product: Product) => {
            if (!user) {
                openLoginModal();
                return;
            }
            mutation.mutate(product.id);
        },
        [user, openLoginModal, mutation]
    );

    return { favorites, toggleFavorite: toggle, isLoading: query.isLoading };
};
