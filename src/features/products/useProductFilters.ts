import { useMemo, useState } from 'react';
import type { Coordinates, Product } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { useRegion } from '@/contexts/RegionContext';
import { calculateDistance } from '@/services/utils';

const NEARBY_KM = 5;

const matchesQuery = (p: Product, q: string) =>
    [
        p.title, p.description, p.category,
        p.title_zh, p.title_en, p.title_es,
        p.description_zh, p.description_en, p.description_es,
    ].some(field => (field || '').toLowerCase().includes(q));

/** Promoted first, then items within 5 km, then by distance. */
const compareProducts = (a: Product, b: Product) => {
    if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1;
    const aClose = (a.distance ?? Infinity) <= NEARBY_KM;
    const bClose = (b.distance ?? Infinity) <= NEARBY_KM;
    if (aClose !== bClose) return aClose ? -1 : 1;
    return (a.distance ?? Infinity) - (b.distance ?? Infinity);
};

/**
 * Client-side search / category / region filtering and distance sorting of the feed.
 */
export const useProductFilters = (products: Product[], origin: Coordinates | null) => {
    const { region, currency: regionCurrency } = useRegion();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const debouncedQuery = useDebounce(searchQuery, 300);

    const filteredProducts = useMemo(() => {
        let filtered = products;

        const q = debouncedQuery.trim().toLowerCase();
        if (q) filtered = filtered.filter(p => matchesQuery(p, q));

        if (selectedCategory !== 'all') filtered = filtered.filter(p => p.category === selectedCategory);

        // Local-market rule: outside "Global", only show items priced in the region's currency.
        if (region !== 'Global') filtered = filtered.filter(p => (p.currency || 'MXN') === regionCurrency);

        if (!origin) return filtered;

        return filtered
            .map(p => ({ ...p, distance: calculateDistance(origin, p.location) }))
            .sort(compareProducts);
    }, [products, origin, debouncedQuery, selectedCategory, region, regionCurrency]);

    return { searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, filteredProducts };
};
