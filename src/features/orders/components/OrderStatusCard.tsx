import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle, MapPin, ChevronRight, Package, Truck, Handshake, Banknote, CreditCard } from 'lucide-react';
import { Order, User } from '@/types';
import { api } from '@/lib/api/client';
import { notify } from '@/lib/toast';
import { queryKeys } from '@/lib/queryClient';
import { useLanguage, useLocale } from '@/i18n';
import { useRegion } from '@/contexts/RegionContext';
import { Button, Card, Chip } from '@/components/ui/primitives';
import { orderStatusLabel, orderStatusTone } from '../orderStatusLabel';
import { MeetupArrangementModal } from './MeetupArrangementModal';

interface OrderStatusCardProps {
    order: Order;
    currentUser: User;
    onStatusChange?: () => void;
    /** Called when the product snapshot is tapped. Defaults to navigating to `/product/:id`. */
    onOpenProduct?: () => void;
    /** Extra actions (cancel / ship / dispute / confirm) rendered in the card footer. */
    actions?: React.ReactNode;
    className?: string;
}

/** Statuses in which a meetup order is paid for but the meetup has not been arranged yet. */
const MEETUP_PENDING_STATUSES: Order['status'][] = ['paid', 'escrow_held'];
/** Statuses in which both parties can confirm completion. */
const CONFIRMABLE_STATUSES: Order['status'][] = ['paid', 'escrow_held', 'meetup_arranged', 'shipped', 'delivered'];
const CLOSED_STATUSES: Order['status'][] = ['completed', 'completed_pending_payout', 'cancelled', 'disputed', 'refunded'];

export const OrderStatusCard: React.FC<OrderStatusCardProps> = ({ order, currentUser, onStatusChange, onOpenProduct, actions, className = '' }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useLanguage();
    const locale = useLocale();
    const { formatCurrency } = useRegion();
    const isBuyer = currentUser.id === order.buyer_id;
    const isMeetup = order.order_type === 'meetup';
    const [isLoading, setIsLoading] = useState(false);
    const [isArmed, setIsArmed] = useState(false);
    const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false);

    // Older API responses named the embed `products`.
    const productData = (order as any).product || (order as any).products || null;

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders(currentUser.id) });
        onStatusChange?.();
    };

    const handleConfirm = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // Two-tap confirmation for an irreversible action.
        if (!isArmed) {
            setIsArmed(true);
            notify.info(t('orders.confirm_irreversible_hint'));
            return;
        }
        setIsArmed(false);
        setIsLoading(true);
        try {
            await api.post(`/api/orders/${order.id}/confirm`, undefined, { auth: 'required' });
            notify.success(t('orders.confirm_success'));
            refresh();
        } catch (error) {
            notify.fromError(error, t('orders.confirm_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenProduct = () => {
        if (onOpenProduct) { onOpenProduct(); return; }
        const productId = order.product_id || productData?.id;
        if (productId) navigate(`/product/${productId}`);
        else notify.error(t('orders.product_unavailable'));
    };

    const createdAt = (order as any).created_at ? new Date((order as any).created_at) : null;
    const total = Number(order.total_amount || 0);

    /** Location / time of the meetup with an Arrange / Update button. */
    const renderMeetupDetails = () => {
        const hasDetails = !!order.meetup_location;
        const canArrange = !CLOSED_STATUSES.includes(order.status);
        return (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0"><MapPin size={18} /></span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{t('orders.meetup_details')}</p>
                        {hasDetails ? (
                            <>
                                <p className="text-sm text-gray-700 mt-0.5">{order.meetup_location}</p>
                                {order.meetup_time && <p className="text-xs font-bold text-brand-700 mt-1 tabular-nums">{new Date(order.meetup_time).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                            </>
                        ) : (
                            <p className="text-sm text-gray-500 mt-0.5">{t('orders.meetup_not_arranged')}</p>
                        )}
                        {!hasDetails && MEETUP_PENDING_STATUSES.includes(order.status) && <p className="text-xs text-gray-500 mt-2">{t('orders.meetup_arrange_hint')}</p>}
                    </div>
                    {canArrange && (
                        <Button size="sm" variant={hasDetails ? 'ghost' : 'secondary'} onClick={e => { e.stopPropagation(); setIsMeetupModalOpen(true); }}>
                            {hasDetails ? t('orders.meetup_update') : t('orders.meetup_arrange')}
                        </Button>
                    )}
                </div>
                <MeetupArrangementModal isOpen={isMeetupModalOpen} onClose={() => setIsMeetupModalOpen(false)} order={order} onSuccess={refresh} />
            </div>
        );
    };

    /** Both-party confirmation block. */
    const renderConfirmation = () => {
        const myConfirmation = isBuyer ? order.buyer_confirmed_at : order.seller_confirmed_at;
        const otherConfirmation = isBuyer ? order.seller_confirmed_at : order.buyer_confirmed_at;
        const row = (label: string, done: boolean, action?: React.ReactNode) => (
            <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-gray-700">{label}</span>
                {done ? <Chip tone="success" icon={<CheckCircle size={12} />}>{t('orders.confirmed')}</Chip>
                    : action ?? <Chip tone="neutral" icon={<Clock size={12} />}>{t('orders.waiting')}</Chip>}
            </div>
        );
        return (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-2 py-1"><CheckCircle size={16} className="text-brand-600" />{t('orders.completion_status')}</p>
                <div className="divide-y divide-gray-100">
                    {row(`${t('orders.you')} (${isBuyer ? t('orders.role_buyer') : t('orders.role_seller')})`, !!myConfirmation,
                        <Button size="sm" onClick={handleConfirm} loading={isLoading} variant={isArmed ? 'danger' : 'primary'}>
                            {isArmed ? t('orders.confirm_receipt_again') : isMeetup ? t('orders.confirm_meetup') : t('orders.confirm_receipt')}
                        </Button>)}
                    {row(isBuyer ? t('orders.role_seller') : t('orders.role_buyer'), !!otherConfirmation)}
                </div>
                {!myConfirmation && <p className="text-xs text-gray-500 pb-1.5 pt-1">{isBuyer ? t('orders.confirm_hint_buyer') : t('orders.confirm_hint_seller')}</p>}
            </div>
        );
    };

    const renderContent = () => {
        if (isMeetup) {
            if (MEETUP_PENDING_STATUSES.includes(order.status) || order.status === 'pending_payment') return renderMeetupDetails();
            if (order.status === 'meetup_arranged') return <>{renderMeetupDetails()}{renderConfirmation()}</>;
            if (CONFIRMABLE_STATUSES.includes(order.status)) return renderConfirmation();
            return order.meetup_location ? renderMeetupDetails() : null;
        }
        // Shipping orders: the buyer confirms receipt once shipped (single action in the footer);
        // the two-party block only appears when a confirmation already exists (legacy orders).
        if (CONFIRMABLE_STATUSES.includes(order.status) && (order.buyer_confirmed_at || order.seller_confirmed_at)) return renderConfirmation();
        return null;
    };

    const content = renderContent();
    const isDone = order.status === 'completed' || order.status === 'completed_pending_payout';

    return (
        <Card padding={false} className={className}>
            {/* Header: product + status */}
            <button type="button" onClick={handleOpenProduct} className="w-full flex items-start gap-3 p-4 text-left rounded-t-2xl hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                <span className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {productData?.images?.[0] ? <img src={productData.images[0]} alt="" className="w-full h-full object-cover" /> : <Package size={24} className="text-gray-300" />}
                </span>
                <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                            <Chip tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status, t, { paymentMethod: order.payment_method })}</Chip>
                            <span className="hidden sm:inline text-[11px] text-gray-400 font-mono">#{order.id.slice(0, 8)}</span>
                        </span>
                        <span className="font-black text-gray-900 tabular-nums flex-shrink-0">{formatCurrency(total, order.currency || 'MXN')}</span>
                    </span>
                    <span className="block mt-1.5 font-bold text-gray-900 truncate">{productData?.title || <span className="text-gray-400 font-normal">{t('orders.product_info_unavailable')}</span>}</span>
                    <span className="mt-0.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">{isMeetup ? <Handshake size={12} /> : <Truck size={12} />}{isMeetup ? t('orders.type_meetup') : t('orders.type_shipping')}</span>
                        <span className="inline-flex items-center gap-1">{order.payment_method === 'cash' ? <Banknote size={12} /> : <CreditCard size={12} />}{order.payment_method === 'cash' ? t('orders.pay_cash') : t('orders.pay_online')}</span>
                        {createdAt && !Number.isNaN(createdAt.getTime()) && <span className="tabular-nums">{createdAt.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>}
                        <span className="sm:hidden text-gray-400 font-mono">#{order.id.slice(0, 8)}</span>
                    </span>
                </span>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-5" />
            </button>

            {(content || isDone) && (
                <div className="px-4 pb-4 space-y-3">
                    {content}
                    {isDone && (
                        <p className="flex items-center gap-2 rounded-xl bg-green-50 px-3.5 py-2.5 text-sm font-medium text-green-700"><CheckCircle size={16} />{t('orders.completed_message')}</p>
                    )}
                </div>
            )}

            {actions && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">{actions}</div>}
        </Card>
    );
};
