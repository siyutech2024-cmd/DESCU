import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useOrders, requiresAction } from '@/features/orders';
import { useBackNavigation } from '@/lib/useBackNavigation';
import OrderList from '@/features/orders/components/OrderList';
import { SignedOutPlaceholder } from '@/components/SignedOutPlaceholder';
import type { User } from '../types';

type Role = 'buyer' | 'seller';

interface OrdersPageProps {
    user: User | null;
}

/**
 * /orders?role=buyer|seller — one place for everything the user is buying or selling.
 * Linked from the profile tabs and the bottom-nav order badge.
 */
export const OrdersPage: React.FC<OrdersPageProps> = ({ user }) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const goBack = useBackNavigation('/profile');
    const [params, setParams] = useSearchParams();
    const { orders } = useOrders();

    const counts = useMemo(() => {
        if (!user) return { buyer: 0, seller: 0 };
        return {
            buyer: orders.filter(o => o.buyer_id === user.id && requiresAction(o, user.id)).length,
            seller: orders.filter(o => o.seller_id === user.id && requiresAction(o, user.id)).length,
        };
    }, [orders, user]);

    const requested = params.get('role');
    // Default to whichever side has something waiting on the user.
    const role: Role = requested === 'seller' || requested === 'buyer'
        ? requested
        : counts.buyer === 0 && counts.seller > 0 ? 'seller' : 'buyer';

    if (!user) return <SignedOutPlaceholder hintKey="auth.signed_out_hint_orders" icon={ShoppingBag} />;

    const setRole = (next: Role) => setParams({ role: next }, { replace: true });

    return (
        <div className="max-w-3xl mx-auto w-full px-4 pt-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <button type="button" onClick={goBack} className="p-2 -ml-2 rounded-full text-gray-500 hover:bg-white/70 hover:text-gray-900 transition-colors" aria-label={t('detail.back')}>
                    <ArrowLeft size={22} />
                </button>
                <h1 className="text-2xl font-black text-gray-900">{t('orders.title')}</h1>
            </div>

            <div className="flex border-b border-gray-200 mb-6" role="tablist">
                {(['buyer', 'seller'] as Role[]).map(r => {
                    const active = role === r;
                    const badge = counts[r];
                    return (
                        <button
                            key={r}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setRole(r)}
                            className={`flex-1 pb-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${active ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {r === 'buyer' ? t('profile.buying') : t('profile.selling')}
                            {badge > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <OrderList role={role} currentUser={user} />

            <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-8 mb-4 mx-auto block text-sm font-bold text-brand-600 hover:text-brand-700"
            >
                {t('orders.keep_shopping')}
            </button>
        </div>
    );
};
