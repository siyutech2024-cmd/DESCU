
import React from 'react';
import { ProductCard } from '../components/ProductCard';
import { RefreshCw, MapPinOff, MapPin, SearchX, Package, Car, Home, Smartphone, Briefcase, Armchair, Shirt, Book, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';
import { Product, Category, Region } from '../types';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';

interface HomePageProps {
    sortedProducts: Product[];
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    isLoadingLoc: boolean;
    permissionDenied: boolean;
    searchQuery: string;
    onSellClick: () => void;
    // cart and onAddToCart removed - direct purchase model
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    favorites: Set<string>;
    onToggleFavorite: (product: Product) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
    sortedProducts,
    selectedCategory,
    setSelectedCategory,
    isLoadingLoc,
    permissionDenied,
    searchQuery,
    onSellClick,
    hasMore,
    isLoadingMore,
    onLoadMore,
    favorites,
    onToggleFavorite
}) => {
    const { t } = useLanguage();
    const { region, setRegion } = useRegion();
    const navigate = useNavigate();

    useSEO({
        title: 'DESCU - Buy & Sell Local Secondhand',
        description: 'The best AI-powered marketplace for buying and selling used items, cars, and real estate nearby.',
    });

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
        <main className="max-w-5xl mx-auto px-2 md:px-4 pb-24 w-full overflow-x-hidden">
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
                <p className="text-gray-500 text-[10px] md:text-base font-bold mt-1.5 tracking-wide bg-white/60 px-3 py-0.5 rounded-full backdrop-blur-md border border-white/50 text-center shadow-sm max-w-[80vw] truncate">{t('hero.subtitle')}</p>

                {/* Mobile Region Selector */}
                <div className="md:hidden mt-3 relative">
                    <div className="flex items-center gap-2 bg-gray-100/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-gray-200 shadow-sm animate-fade-in">
                        <MapPin size={13} className="text-brand-600" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Deliver to:</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm">
                                {region === 'MX' ? '🇲🇽' : region === 'US' ? '🇺🇸' : region === 'CN' ? '🇨🇳' : region === 'EU' ? '🇪🇺' : region === 'JP' ? '🇯🇵' : '🌍'}
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                                {region === 'MX' ? 'Mexico' : region === 'US' ? 'USA' : region === 'CN' ? 'China' : region === 'EU' ? 'Europe' : region === 'JP' ? 'Japan' : 'Global'}
                            </span>
                        </div>
                    </div>
                    <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value as Region)}
                        className="absolute inset-0 w-full h-full opacity-0 z-10"
                    >
                        <option value="MX">Mexico</option>
                        <option value="US">USA</option>
                        <option value="CN">China</option>
                        <option value="EU">Europe</option>
                        <option value="JP">Japan</option>
                        <option value="Global">Global</option>
                    </select>
                </div>
            </div>

            {/* Category Filter - Glass Pills */}
            <div className="flex gap-3 overflow-x-auto pb-4 mb-4 no-scrollbar px-1">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex flex-col items-center flex-shrink-0 gap-1.5 min-w-[68px] group transition-all duration-300 ${selectedCategory === cat.id ? 'opacity-100 scale-105' : 'opacity-100 hover:scale-105'}`}
                    >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${selectedCategory === cat.id
                            ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-600/40' // Darker brand color
                            : 'bg-white text-gray-700 shadow-sm border border-gray-200 group-hover:bg-gray-50 group-hover:border-brand-200' // Solid white, darker text
                            }`}>
                            <cat.icon size={22} strokeWidth={selectedCategory === cat.id ? 2.5 : 2} />
                        </div>
                        <span className={`text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded-full ${selectedCategory === cat.id
                            ? 'text-brand-800 bg-brand-100'
                            : 'text-gray-700 group-hover:text-gray-900'
                            }`}>
                            {t(cat.label)}
                        </span>
                    </button>
                ))}
            </div>

            <div className="flex items-center justify-between mb-6 px-1">
                <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                    {selectedCategory === 'all' ? t('list.header') : t(`cat.${selectedCategory}`)}
                    <span className="text-sm font-normal text-gray-400 bg-white/50 px-2 py-0.5 rounded-full backdrop-blur-xs border border-white/40">{sortedProducts.length}</span>
                </h2>

                <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-sm transition-all hover:bg-white/80 cursor-pointer">
                    {isLoadingLoc ? (
                        <span className="flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin text-brand-500" /> {t('list.loading_loc')}</span>
                    ) : permissionDenied ? (
                        <span className="flex items-center gap-1.5 text-orange-500 font-bold"><MapPinOff size={12} /> {t('list.loc_denied')}</span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-brand-600 font-bold"><RefreshCw size={12} /> {t('list.loc_success')}</span>
                    )}
                </div>
            </div>

            {sortedProducts.length === 0 ? (
                <div className="text-center py-24 glass-panel rounded-[2.5rem] flex flex-col items-center justify-center">
                    <div className="bg-gray-50/50 w-28 h-28 rounded-full flex items-center justify-center mb-6 text-gray-300 border-2 border-dashed border-gray-200">
                        {searchQuery ? <SearchX size={48} /> : <Package size={48} />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {searchQuery ? t('list.no_results') : t('list.empty')}
                    </h3>
                    <p className="text-gray-400 max-w-xs mx-auto mb-6 leading-relaxed">
                        {searchQuery ? 'Suggestions: check spelling or try broader terms.' : 'Be the first to list an item in this category!'}
                    </p>
                    {!searchQuery && (
                        <button onClick={onSellClick} className="px-8 py-3 bg-brand-600 text-white font-bold rounded-full shadow-lg shadow-brand-200 hover:scale-105 active:scale-95 transition-all">
                            {t('nav.sell')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-8 pb-20">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
                        {sortedProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                // onAddToCart removed
                                isInCart={false}
                                onClick={(p) => navigate(`/product/${p.id}`)}
                                isFavorite={favorites.has(product.id)}
                                onToggleFavorite={onToggleFavorite}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={onLoadMore}
                                disabled={isLoadingMore}
                                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-full shadow-sm border border-gray-200 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoadingMore ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" />
                                        {t('list.loading_more')}
                                    </>
                                ) : (
                                    <>
                                        {t('list.load_more')}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="text-center py-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm border border-white/20 text-gray-400 text-xs font-medium">
                    <span>DESCU Marketplace © 2024</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span>Premium Resale</span>
                </div>
            </div>
        </main>
    );
};
