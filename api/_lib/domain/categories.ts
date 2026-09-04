/**
 * Product categories — one canonical spelling per category (the `Category` enum the client
 * uses), plus every legacy spelling that ended up in `products.category` over time
 * (lowercase from the AI auto-review, snake_case, Spanish labels, hierarchical AI paths).
 */

export const CANONICAL_CATEGORIES = [
    'Electronics', 'Furniture', 'Clothing', 'Books', 'Sports', 'Vehicles', 'RealEstate', 'Services', 'Other',
] as const;
export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

/** Legacy / foreign spellings → canonical. Keys are compared after lowercasing and stripping spaces, `_`, `-`, `&`. */
const ALIASES: Record<string, CanonicalCategory> = {
    electronics: 'Electronics', electronica: 'Electronics', electrónica: 'Electronics', electronic: 'Electronics',
    furniture: 'Furniture', home: 'Furniture', hogar: 'Furniture', homegarden: 'Furniture', muebles: 'Furniture',
    clothing: 'Clothing', clothes: 'Clothing', fashion: 'Clothing', moda: 'Clothing', ropa: 'Clothing', healthbeauty: 'Clothing',
    books: 'Books', book: 'Books', libros: 'Books',
    sports: 'Sports', sport: 'Sports', deportes: 'Sports',
    vehicles: 'Vehicles', vehicle: 'Vehicles', autos: 'Vehicles', auto: 'Vehicles', cars: 'Vehicles',
    realestate: 'RealEstate', inmuebles: 'RealEstate', property: 'RealEstate',
    services: 'Services', service: 'Services', servicios: 'Services',
    other: 'Other', otros: 'Other', others: 'Other', misc: 'Other',
};

const fold = (s: string) => s.toLowerCase().replace(/[\s_\-&]/g, '');

/** Canonical category for any stored/submitted spelling; unknown values (incl. AI paths like "Food & Snacks") → Other. */
export const normalizeCategory = (raw: unknown): CanonicalCategory => {
    if (typeof raw !== 'string' || !raw.trim()) return 'Other';
    // Hierarchical AI output ("Health & Beauty > Fragrances"): classify by the top level.
    const top = raw.split('>')[0].trim();
    const direct = CANONICAL_CATEGORIES.find(c => c === top);
    if (direct) return direct;
    return ALIASES[fold(top)] ?? 'Other';
};

/**
 * Every stored spelling that means `category`, for a PostgREST `.in('category', …)` filter.
 * Only exact stored values match, so this covers the canonical, lowercase, snake_case and alias forms.
 */
export const categoryVariants = (raw: unknown): string[] => {
    const canonical = normalizeCategory(raw);
    const variants = new Set<string>([canonical, canonical.toLowerCase()]);
    if (canonical === 'RealEstate') variants.add('real_estate');
    for (const [alias, target] of Object.entries(ALIASES)) {
        if (target === canonical) {
            variants.add(alias);
            variants.add(alias.charAt(0).toUpperCase() + alias.slice(1));
        }
    }
    // Historic capitalised English labels with spaces
    if (canonical === 'Furniture') { variants.add('Home & Garden'); variants.add('Home'); }
    if (canonical === 'Clothing') { variants.add('Health & Beauty'); variants.add('Fashion'); }
    return [...variants];
};
