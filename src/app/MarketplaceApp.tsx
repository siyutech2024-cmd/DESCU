import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { useLanguage } from '@/i18n';
import { useAuth } from '@/features/auth';
import { useGeolocation, FALLBACK_LOCATION } from '@/features/location';
import { useProducts, useProductFilters, useFavorites, useCreateProduct } from '@/features/products';
import { useConversations } from '@/features/chat';
import { useOrders } from '@/features/orders';
import { notify } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { useUrlModal } from '@/lib/useUrlModal';
import { PageLoader } from './PageLoader';

// Pages — code-split
const HomePage = React.lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })));
const ProductPage = React.lazy(() => import('@/pages/ProductPage').then(m => ({ default: m.ProductPage })));
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const OrdersPage = React.lazy(() => import('@/pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const ChatPage = React.lazy(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage })));
const UserProfilePage = React.lazy(() => import('@/pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const PrivacyPolicyPage = React.lazy(() => import('@/pages/PrivacyPolicyPage'));

// Modals — code-split
const SellModal = React.lazy(() => import('@/features/products/components/SellModal').then(m => ({ default: m.SellModal })));
const LoginModal = React.lazy(() => import('@/features/auth/components/LoginModal').then(m => ({ default: m.LoginModal })));
const OnboardingModal = React.lazy(() => import('@/components/OnboardingModal').then(m => ({ default: m.OnboardingModal })));

type BottomNavView = 'home' | 'chat-list' | 'profile' | 'product';

const viewFromPath = (path: string): BottomNavView => {
    if (path.startsWith('/chat')) return 'chat-list';
    if (path.startsWith('/profile') || path.startsWith('/orders')) return 'profile';
    if (path.startsWith('/product')) return 'product';
    return 'home';
};

/**
 * Marketplace shell: navigation chrome, routes and global modals.
 * All data flows through feature hooks; pages receive plain props.
 */
export const MarketplaceApp: React.FC = () => {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const { user, login, updateUser, markVerified, isLoginModalOpen, openLoginModal, closeLoginModal, requireUser } = useAuth();
    const geo = useGeolocation();
    const origin = geo.location;
    // The feed renders right away against the fallback location; once the real position
    // resolves, distances are recomputed client-side and the list re-sorted (no refetch).
    const feedOrigin = origin ?? FALLBACK_LOCATION;

    // Category lives here so the feed refetches server-side (filtering only the loaded page hid results).
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const feed = useProducts(feedOrigin, { category: selectedCategory });
    const filters = useProductFilters(feed.products, feedOrigin, selectedCategory);
    const { favorites, toggleFavorite } = useFavorites();
    const chat = useConversations();
    const { actionRequiredCount } = useOrders();

    // The sell sheet lives in the URL (`?sell=1`) so the back button closes it and deep links open it.
    const { isOpen: isSellModalOpen, open: openSellModal, close: closeSellModal } = useUrlModal('sell');

    const { createProduct } = useCreateProduct(user, {
        onCreated: product => {
            feed.prependProduct(product);
            // Land on the feed with the sheet closed, without stacking history entries.
            navigate('/', { replace: true });
        },
    });

    useEffect(() => {
        document.title = 'DESCU';
    }, [language]);

    const lastToastedError = useRef<unknown>(null);
    useEffect(() => {
        if (feed.error && feed.error !== lastToastedError.current) {
            lastToastedError.current = feed.error;
            notify.error(`${t('toast.load_failed')}: ${getErrorMessage(feed.error)}`);
        }
    }, [feed.error, t]);

    const currentView = useMemo(() => viewFromPath(pathname), [pathname]);

    const handleSellClick = () => requireUser(openSellModal);

    return (
        <div className="min-h-dvh bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50 animate-gradient-xy flex flex-col font-sans text-gray-900 selection:bg-brand-100 selection:text-brand-900">
            <Navbar
                user={user}
                onLogin={login}
                onSellClick={handleSellClick}
                searchQuery={filters.searchQuery}
                onSearchChange={filters.setSearchQuery}
                onProfileClick={() => navigate('/profile')}
                onLogoClick={() => navigate('/')}
                onChatClick={() => navigate('/chat')}
                unreadCount={chat.unreadCount}
                locationInfo={geo.locationInfo}
            />

            <div className="flex-1 flex flex-col relative w-full max-w-[100vw] overflow-x-hidden pb-bottom-nav md:pb-0">
                <React.Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <HomePage
                                    sortedProducts={filters.filteredProducts}
                                    selectedCategory={selectedCategory}
                                    setSelectedCategory={setSelectedCategory}
                                    isLoadingLoc={geo.isLoading}
                                    isLoadingProducts={feed.isLoading}
                                    permissionDenied={geo.permissionDenied}
                                    searchQuery={filters.searchQuery}
                                    onSellClick={handleSellClick}
                                    hasMore={feed.hasMore}
                                    isLoadingMore={feed.isLoadingMore}
                                    onLoadMore={feed.loadMore}
                                    favorites={favorites}
                                    onToggleFavorite={toggleFavorite}
                                    locationInfo={geo.locationInfo}
                                />
                            }
                        />
                        <Route
                            path="/product/:id"
                            element={
                                <ProductPage
                                    products={feed.products}
                                    onContactSeller={chat.contactSeller}
                                    onRequireLogin={openLoginModal}
                                    user={user}
                                />
                            }
                        />
                        <Route
                            path="/profile"
                            element={
                                <ProfilePage
                                    user={user}
                                    products={feed.products}
                                    onLogin={login}
                                    onUpdateUser={updateUser}
                                    onVerifyUser={markVerified}
                                    onBoostProduct={id => feed.patchProduct(id, { is_promoted: true })}
                                    favorites={favorites}
                                    allProducts={filters.filteredProducts}
                                />
                            }
                        />
                        <Route
                            path="/chat/:id?"
                            element={
                                <ChatPage
                                    conversations={chat.conversations}
                                    user={user}
                                    onLogin={login}
                                    onSendMessage={chat.sendMessage}
                                />
                            }
                        />
                        <Route path="/orders" element={<OrdersPage user={user} />} />
                        <Route path="/user/:id" element={<UserProfilePage currentUserId={user?.id} />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </React.Suspense>
            </div>

            <BottomNav
                currentView={currentView}
                onChangeView={view => {
                    if (view === 'home') navigate('/');
                    if (view === 'profile') navigate('/profile');
                    if (view === 'chat-list') navigate('/chat');
                }}
                onSellClick={handleSellClick}
                unreadCount={chat.unreadCount}
                orderCount={actionRequiredCount}
                locationInfo={geo.locationInfo}
                user={user}
            />

            <React.Suspense fallback={null}>
                {isSellModalOpen && user && (
                    <SellModal
                        isOpen={isSellModalOpen}
                        onClose={closeSellModal}
                        onSubmit={createProduct}
                        user={user}
                        userLocation={origin}
                    />
                )}
                {isLoginModalOpen && <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} onLogin={login} />}
                <OnboardingModal />
            </React.Suspense>
        </div>
    );
};
