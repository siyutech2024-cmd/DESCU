
import React from 'react';
import { ProductCard } from '@/features/products/components/ProductCard';
import { RefreshCw, MapPinOff, MapPin, SearchX, Package, Car, Home, Smartphone, Briefcase, Armchair, Shirt, Book, Trophy } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useRegion, REGIONS, REGION_CONFIG } from '../contexts/RegionContext';
import { Product, Category, Region } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { Button, EmptyState } from '@/components/ui/primitives';
import { DetailedLocationInfo } from '../services/locationService';
// Shared with the bot prerender so both render the same titles.
import { SITE_TEXT, categoryLabel } from '../../api/_lib/seo/site';

interface HomePageProps {
    sortedProducts: Product[];
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    isLoadingLoc: boolean;
    isLoadingProducts: boolean;
    permissionDenied: boolean;
    searchQuery: string;
    onSellClick: () => void;
    // cart and onAddToCart removed - direct purchase model
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    favorites: Set<string>;
    onToggleFavorite: (product: Product) => void;
    locationInfo?: DetailedLocationInfo | null;
}

export const HomePage: React.FC<HomePageProps> = ({
    sortedProducts,
    selectedCategory,
    setSelectedCategory,
    isLoadingLoc,
    isLoadingProducts,
    permissionDenied,
    searchQuery,
    onSellClick,
    hasMore,
    isLoadingMore,
    onLoadMore,
    favorites,
    onToggleFavorite,
    locationInfo
}) => {
    const { t, language } = useLanguage();
    const { region, setRegion } = useRegion();
    const navigate = useNavigate();

    // Title/description follow the language and the active category (also used for /buy/{category}/in/{city}).
    const seoText = SITE_TEXT[language];
    const seoCategory = selectedCategory !== 'all' ? categoryLabel(selectedCategory, language) : null;
    useSEO({
        title: seoCategory
            ? (language === 'en' ? `Used ${seoCategory} in Mexico | DESCU` : language === 'zh' ? `墨西哥二手${seoCategory} | DESCU` : `${seoCategory} de segunda mano en México | DESCU`)
            : seoText.homeTitle,
        description: seoCategory
            ? (language === 'en' ? `Pre-owned ${seoCategory.toLowerCase()} near you in Mexico. ${seoText.shortDesc}` : language === 'zh' ? `墨西哥附近的二手${seoCategory}。${seoText.shortDesc}` : `${seoCategory} de segunda mano cerca de ti en México. ${seoText.shortDesc}`)
            : seoText.homeDesc,
    });

    // Map Category enum values to translation keys (enum values like "RealEstate" don't match keys like "real_estate")
    const CATEGORY_LABEL_MAP: Record<string, string> = {
        'all': 'cat.all',
        [Category.Electronics]: 'cat.electronics',
        [Category.Furniture]: 'cat.furniture',
        [Category.Clothing]: 'cat.clothing',
        [Category.Books]: 'cat.books',
        [Category.Sports]: 'cat.sports',
        [Category.Vehicles]: 'cat.vehicles',
        [Category.RealEstate]: 'cat.real_estate',
        [Category.Services]: 'cat.services',
        [Category.Other]: 'cat.other',
    };

    const CATEGORIES = [
        { id: 'all', icon: RefreshCw, label: 'cat.all' },
        { id: Category.Vehicles, icon: Car, label: 'cat.vehicles' },
        { id: Category.RealEstate, icon: Home, label: 'cat.real_estate' },
        { id: Category.Electronics, icon: Smartphone, label: 'cat.electronics' },
        { id: Category.Services, icon: Briefcase, label: 'cat.services' },
        { id: Category.Furniture, icon: Armchair, label: 'cat.furniture' },
        { id: Category.Clothing, icon: Shirt, label: 'cat.clothing' },
        { id: Category.Sports, icon: Trophy, label: 'cat.sports' },
        { id: Category.Books, icon: Book, label: 'cat.books' },
        { id: Category.Other, icon: Package, label: 'cat.other' },
    ];

    return (
        <main className="max-w-5xl mx-auto px-2 md:px-4 w-full overflow-x-hidden">
            {/* DESCU Brand Header */}
            {/* DESCU Brand Header - More Compact on Mobile */}
            <div className="flex flex-col items-center justify-center pt-4 pb-3 md:pt-10 md:pb-8">
                <div className="flex items-center gap-2 md:gap-3 animate-fade-in-up">
                    <div className="w-8 h-8 md:w-16 md:h-16 bg-brand-600 text-white flex items-center justify-center rounded-lg md:rounded-2xl shadow-lg shadow-brand-500/30">
                        <svg viewBox="0 0 100 100" className="w-5 h-5 md:w-10 md:h-10 fill-none stroke-white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M30 20 H50 C70 20 85 35 85 50 C85 65 70 80 50 80 H30 Z" />
                            <circle cx="45" cy="40" r="5" fill="white" stroke="none" />
                            <path d="M30 20 V80" />
                        </svg>
                    </div>
                    <h1 className="text-2xl md:text-5xl font-black text-gray-900 tracking-tighter drop-shadow-sm">DESCU</h1>
                </div>
                <p className="text-gray-500 text-xs md:text-base font-bold mt-1.5 tracking-wide text-center max-w-[80vw] truncate">{t('hero.subtitle')}</p>

                {/* Mobile Region Selector */}
                <div className="md:hidden mt-3 relative">
                    <div className="flex items-center gap-2 bg-white px-3.5 h-9 rounded-full border border-gray-200 shadow-sm animate-fade-in">
                        <MapPin size={13} className="text-brand-600" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{t('home.deliver_to')}:</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm">{REGION_CONFIG[region].flag}</span>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-900">
                                    {locationInfo?.city || REGION_CONFIG[region].label}
                                </span>
                                {(locationInfo?.town || locationInfo?.district) && (
                                    <span className="text-[9px] text-gray-600">
                                        {locationInfo.town || locationInfo.district}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value as Region)}
                        className="absolute inset-0 w-full h-full opacity-0 z-10"
                    >
                        {REGIONS.map(r => (
                            <option key={r.code} value={r.code}>{r.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Category strip */}
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-3 mb-3 no-scrollbar px-1 -mx-1" role="tablist" aria-label={t('cat.all')}>
                {CATEGORIES.map(cat => {
                    const active = selectedCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setSelectedCategory(cat.id)}
                            className="flex flex-col items-center flex-shrink-0 gap-1.5 w-[68px] md:w-[76px] group focus:outline-none"
                        >
                            <span className={`w-[52px] h-[52px] md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-200 group-focus-visible:ring-4 group-focus-visible:ring-brand-200 ${active
                                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30'
                                : 'bg-white text-gray-700 border border-gray-200 group-hover:border-brand-200 group-hover:text-brand-700'}`}>
                                <cat.icon size={22} strokeWidth={active ? 2.5 : 2} />
                            </span>
                            <span className={`text-[11px] leading-none font-bold whitespace-nowrap ${active ? 'text-brand-700' : 'text-gray-600 group-hover:text-gray-900'}`}>{t(cat.label)}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-3 mb-4 px-1">
                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2 min-w-0">
                    <span className="truncate">{selectedCategory === 'all' ? t('list.header') : t(CATEGORY_LABEL_MAP[selectedCategory] || `cat.${selectedCategory}`)}</span>
                    <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full tabular-nums">{sortedProducts.length}</span>
                </h2>
                <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap border ${permissionDenied ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {isLoadingLoc ? <><RefreshCw size={12} className="animate-spin text-brand-500" /><span className="hidden sm:inline">{t('list.loading_loc')}</span></>
                        : permissionDenied ? <><MapPinOff size={12} /><span>{t('list.loc_denied')}</span></>
                        : <><MapPin size={12} className="text-brand-600" /><span className="hidden sm:inline">{t('list.loc_success')}</span></>}
                </span>
            </div>

            {isLoadingProducts ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
                            <div className="aspect-square bg-gray-200" />
                            <div className="p-3 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-3 bg-gray-100 rounded w-1/2" />
                                <div className="h-5 bg-brand-100 rounded w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : sortedProducts.length === 0 ? (
                <EmptyState
                    icon={searchQuery ? <SearchX size={30} /> : <Package size={30} />}
                    title={searchQuery ? t('list.no_results') : t('list.empty')}
                    hint={searchQuery ? t('list.search_hint') : t('list.empty_hint')}
                    action={!searchQuery ? <Button size="lg" onClick={onSellClick}>{t('nav.sell')}</Button> : undefined}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20"
                />
            ) : (
                <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
                        {sortedProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                isInCart={false}
                                onClick={(p) => navigate(`/product/${p.id}`)}
                                isFavorite={favorites.has(product.id)}
                                onToggleFavorite={onToggleFavorite}
                                priority={index < 4}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <Button variant="secondary" size="lg" onClick={onLoadMore} loading={isLoadingMore} className="min-w-[200px]">
                                {isLoadingMore ? t('list.loading_more') : t('list.load_more')}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-10 text-xs font-medium text-gray-400">
                <span>© {new Date().getFullYear()} DESCU</span>
                <Link to="/como-funciona" className="hover:text-brand-600">{t('footer.how_it_works')}</Link>
                <Link to="/privacy-policy" className="hover:text-brand-600">{t('footer.privacy')}</Link>
            </footer>
        </main>
    );
};
