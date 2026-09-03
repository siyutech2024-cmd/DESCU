import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient, InfiniteData } from '@tanstack/react-query';
import type { Coordinates, Product } from '@/types';
import { useLanguage } from '@/i18n';
import { queryKeys } from '@/lib/queryClient';
import { isAbortError } from '@/lib/errors';
import { listProducts, PRODUCTS_PAGE_SIZE } from './productsApi';
import { mapApiProduct, type ApiProduct } from './productMapper';

type ProductPages = InfiniteData<ApiProduct[], number>;

/**
 * Paginated product feed for the current language.
 * The query is disabled until a location is known so distances can be computed.
 */
export const useProducts = (origin: Coordinates | null) => {
    const { language } = useLanguage();
    const queryClient = useQueryClient();
    const queryKey = useMemo(() => queryKeys.products.list(language), [language]);

    const query = useInfiniteQuery<ApiProduct[], Error, ProductPages, typeof queryKey, number>({
        queryKey,
        enabled: origin !== null,
        initialPageParam: 1,
        queryFn: ({ pageParam, signal }) => listProducts({ language, page: pageParam }, signal),
        getNextPageParam: (lastPage, pages) => (lastPage.length < PRODUCTS_PAGE_SIZE ? undefined : pages.length + 1),
    });

    const products = useMemo<Product[]>(
        () => (query.data?.pages ?? []).flat().map(p => mapApiProduct(p, origin)),
        [query.data, origin]
    );

    /** Insert a freshly created product at the top of the feed without refetching. */
    const prependProduct = useCallback(
        (product: ApiProduct) => {
            queryClient.setQueryData<ProductPages>(queryKey, current => {
                if (!current) return { pages: [[product]], pageParams: [1] };
                const [first = [], ...rest] = current.pages;
                return { ...current, pages: [[product, ...first], ...rest] };
            });
        },
        [queryClient, queryKey]
    );

    /** Patch fields on a product already in the feed (e.g. after boosting). */
    const patchProduct = useCallback(
        (productId: string, patch: Partial<ApiProduct>) => {
            queryClient.setQueryData<ProductPages>(queryKey, current =>
                current
                    ? { ...current, pages: current.pages.map(page => page.map(p => (p.id === productId ? { ...p, ...patch } : p))) }
                    : current
            );
        },
        [queryClient, queryKey]
    );

    const error = query.error && !isAbortError(query.error) ? query.error : null;

    return {
        products,
        // Treat "waiting for a location" as loading so the feed shows skeletons, not the empty state.
        isLoading: origin === null || query.isPending,
        isLoadingMore: query.isFetchingNextPage,
        hasMore: query.hasNextPage ?? false,
        loadMore: () => {
            if (!query.isFetchingNextPage && query.hasNextPage) query.fetchNextPage();
        },
        error,
        refetch: query.refetch,
        prependProduct,
        patchProduct,
    };
};
