
import React from 'react';
import { Product, Category } from '../types';
import { ProductCard } from '../components/ProductCard';
import { RefreshCw, MapPinOff, SearchX, Package, Car, Home, Smartphone, Briefcase, Armchair, Shirt, Book, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
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
    onAddToCart: (product: Product) => void;
    cart: Product[];
}

export const HomePage: React.FC<HomePageProps> = ({
    sortedProducts,
    selectedCategory,
    setSelectedCategory,
    isLoadingLoc,
    permissionDenied,
    searchQuery,
    onSellClick,
    onAddToCart,
    cart,
}) => {
    const { t } = useLanguage();
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
        <main className="max-w-5xl mx-auto px-4 pb-24">
            {/* DESCU Brand Header */}
            <div className="flex flex-col items-center justify-center pt-10 pb-8">
                <div className="flex items-center gap-3 animate-fade-in-up">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-600 text-white flex items-center justify-center rounded-2xl shadow-xl shadow-brand-500/30 transform hover:scale-105 transition-transform backdrop-blur-sm bg-opacity-90">
                        <svg viewBox="0 0 100 100" className="w-8 h-8 md:w-10 md:h-10 fill-none stroke-white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M30 20 H50 C70 20 85 35 85 50 C85 65 70 80 50 80 H30 Z" />
                            <circle cx="45" cy="40" r="5" fill="white" stroke="none" />
                            <path d="M30 20 V80" />
                        </svg>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-800 tracking-tighter drop-shadow-sm">DESCU</h1>
                </div>
                <p className="text-gray-500 text-xs md:text-base font-medium mt-3 tracking-wide bg-white/40 px-4 py-1 rounded-full backdrop-blur-sm border border-white/40 text-center">{t('hero.subtitle')}</p>
            </div>

            {/* Category Filter - Glass Pills */}
            <div className="flex gap-4 overflow-x-auto pb-6 mb-6 no-scrollbar px-1">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex flex-col items-center flex-shrink-0 gap-2 min-w-[76px] group transition-all duration-300 ${selectedCategory === cat.id ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                    >
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-300 ${selectedCategory === cat.id
                            ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/40'
                            : 'bg-white/60 backdrop-blur-md text-gray-600 shadow-sm border border-white/60 group-hover:bg-white/80'
                            }`}>
                            <cat.icon size={26} strokeWidth={selectedCategory === cat.id ? 2.5 : 2} />
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded-full ${selectedCategory === cat.id
                            ? 'text-brand-700 bg-brand-50/50'
                            : 'text-gray-500 group-hover:text-gray-700'
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                    {sortedProducts.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={onAddToCart}
                            isInCart={cart.some(item => item.id === product.id)}
                            onClick={(p) => navigate(`/product/${p.id}`)}
                        />
                    ))}
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
