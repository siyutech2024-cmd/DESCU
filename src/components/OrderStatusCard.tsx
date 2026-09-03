import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    Clock,
    CheckCircle,
    MapPin,
    ChevronRight,
    Package
} from 'lucide-react';
import { Order, User } from '../types';
import { api } from '@/lib/api/client';
import { notify } from '@/lib/toast';
import { queryKeys } from '@/lib/queryClient';
import { useLanguage } from '@/i18n';
import { MeetupArrangementModal } from './MeetupArrangementModal';

interface OrderStatusCardProps {
    order: Order;
    currentUser: User;
    onStatusChange?: () => void;
    /** Called when the product snapshot is tapped. Defaults to navigating to `/product/:id`. */
    onOpenProduct?: () => void;
    className?: string;
}

/** Statuses in which a meetup order is paid for but the meetup has not been arranged yet. */
const MEETUP_PENDING_STATUSES: Order['status'][] = ['paid', 'escrow_held'];
/** Statuses in which both parties can confirm completion. */
const CONFIRMABLE_STATUSES: Order['status'][] = ['paid', 'escrow_held', 'meetup_arranged', 'shipped', 'delivered'];
const CLOSED_STATUSES: Order['status'][] = ['completed', 'completed_pending_payout', 'cancelled', 'disputed', 'refunded'];

export const OrderStatusCard: React.FC<OrderStatusCardProps> = ({ order, currentUser, onStatusChange, onOpenProduct, className = '' }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useLanguage();
    const isBuyer = currentUser.id === order.buyer_id;
    const isMeetup = order.order_type === 'meetup';
    const [isLoading, setIsLoading] = useState(false);
    const [isArmed, setIsArmed] = useState(false);
    const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false);

    // HOTFIX: Support both 'product' and 'products' field names
    // API should return 'product' but due to deployment delays, it might still return 'products'
    const productData = (order as any).product || (order as any).products || null;

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders(currentUser.id) });
        onStatusChange?.();
    };

    const handleConfirm = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // Two-tap confirmation (replaces the blocking `confirm()` dialog) for an irreversible action.
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

    const handleOpenProduct = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onOpenProduct) {
            onOpenProduct();
            return;
        }
        const productId = order.product_id || productData?.id;
        if (productId) {
            navigate(`/product/${productId}`);
        } else {
            notify.error(t('orders.product_unavailable'));
        }
    };

    const StatusBadge = () => {
        const styles: Record<Order['status'], string> = {
            pending_payment: 'bg-yellow-100 text-yellow-700',
            paid: 'bg-blue-100 text-blue-700',
            escrow_held: 'bg-blue-100 text-blue-700',
            meetup_arranged: 'bg-purple-100 text-purple-700',
            shipped: 'bg-indigo-100 text-indigo-700',
            delivered: 'bg-teal-100 text-teal-700',
            completed: 'bg-green-100 text-green-700',
            completed_pending_payout: 'bg-green-100 text-green-700',
            cancelled: 'bg-gray-100 text-gray-700',
            disputed: 'bg-red-100 text-red-700',
            refunded: 'bg-gray-100 text-gray-500 line-through',
        };

        const labels: Record<Order['status'], string> = {
            pending_payment: t('orders.status.pending_payment'),
            paid: t('orders.status.paid'),
            escrow_held: t('orders.status.escrow_held'),
            meetup_arranged: t('orders.status.meetup_arranged'),
            shipped: t('orders.status.shipped'),
            delivered: t('orders.status.delivered'),
            completed: t('orders.status.completed'),
            completed_pending_payout: t('orders.status.completed'),
            cancelled: t('orders.status.cancelled'),
            disputed: t('orders.status.disputed'),
            refunded: t('orders.status.refunded'),
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles[order.status] || 'bg-gray-100'}`}>
                {labels[order.status] || order.status}
            </span>
        );
    };

    /** Location / time of the meetup with an Arrange / Update button. */
    const renderMeetupDetails = () => {
        const hasDetails = !!order.meetup_location;
        const canArrange = !CLOSED_STATUSES.includes(order.status);

        return (
            <>
                <div className="mt-4 bg-white/50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-sm">{t('orders.meetup_details')}</h4>
                                {hasDetails ? (
                                    <>
                                        <p className="text-sm text-gray-600 mt-1">{order.meetup_location}</p>
                                        {order.meetup_time && (
                                            <p className="text-xs text-blue-600 font-bold mt-1 bg-blue-50 w-fit px-2 py-1 rounded">
                                                {new Date(order.meetup_time).toLocaleString()}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-500 mt-1 italic">{t('orders.meetup_not_arranged')}</p>
                                )}
                            </div>
                        </div>

                        {canArrange && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsMeetupModalOpen(true); }}
                                className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                            >
                                {hasDetails ? t('orders.meetup_update') : t('orders.meetup_arrange')}
                            </button>
                        )}
                    </div>
                    {!hasDetails && MEETUP_PENDING_STATUSES.includes(order.status) && (
                        <p className="text-xs text-blue-600 mt-3 bg-blue-50 p-2 rounded-lg">
                            {t('orders.meetup_arrange_hint')}
                        </p>
                    )}
                </div>
                <MeetupArrangementModal
                    isOpen={isMeetupModalOpen}
                    onClose={() => setIsMeetupModalOpen(false)}
                    order={order}
                    onSuccess={refresh}
                />
            </>
        );
    };

    /** Both-party confirmation block. */
    const renderConfirmation = () => {
        const myConfirmation = isBuyer ? order.buyer_confirmed_at : order.seller_confirmed_at;
        const otherConfirmation = isBuyer ? order.seller_confirmed_at : order.buyer_confirmed_at;
        const otherRoleLabel = isBuyer ? t('orders.role_seller') : t('orders.role_buyer');

        return (
            <div className="mt-4 bg-white/50 rounded-xl p-4 border border-brand-100">
                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <CheckCircle size={18} className="text-brand-600" />
                    {t('orders.completion_status')}
                </h4>

                <div className="space-y-3">
                    {/* My Status */}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                            {t('orders.you')} ({isBuyer ? t('orders.role_buyer') : t('orders.role_seller')})
                        </span>
                        {myConfirmation ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                                <CheckCircle size={12} /> {t('orders.confirmed')}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isLoading}
                                className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-60"
                            >
                                {isLoading
                                    ? '...'
                                    : isArmed
                                        ? t('orders.confirm_receipt_again')
                                        : isMeetup ? t('orders.confirm_meetup') : t('orders.confirm_receipt')}
                            </button>
                        )}
                    </div>

                    {/* Other Party Status */}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{otherRoleLabel}</span>
                        {otherConfirmation ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                                <CheckCircle size={12} /> {t('orders.confirmed')}
                            </span>
                        ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-medium flex items-center gap-1">
                                <Clock size={12} /> {t('orders.waiting')}
                            </span>
                        )}
                    </div>
                </div>

                {!myConfirmation && (
                    <p className="text-xs text-brand-600 mt-2 bg-brand-50 p-2 rounded-lg">
                        {isBuyer ? t('orders.confirm_hint_buyer') : t('orders.confirm_hint_seller')}
                    </p>
                )}
            </div>
        );
    };

    // Determine content based on order type + status
    const renderContent = () => {
        if (isMeetup) {
            // Cash meetup orders are created directly in `paid`; the meetup must still be arranged.
            if (MEETUP_PENDING_STATUSES.includes(order.status) || order.status === 'pending_payment') {
                return renderMeetupDetails();
            }
            // Meetup arranged: show the arranged details plus the confirmation block.
            if (order.status === 'meetup_arranged') {
                return (
                    <>
                        {renderMeetupDetails()}
                        {renderConfirmation()}
                    </>
                );
            }
            if (CONFIRMABLE_STATUSES.includes(order.status)) {
                return renderConfirmation();
            }
            // Closed orders: show the arranged details for reference.
            return order.meetup_location ? renderMeetupDetails() : null;
        }

        // Shipping orders: the buyer confirms receipt once the item has shipped (single
        // "Confirm receipt" action rendered by OrderList). The two-party block is only shown
        // when a confirmation already exists on the row (legacy orders).
        if (CONFIRMABLE_STATUSES.includes(order.status) && (order.buyer_confirmed_at || order.seller_confirmed_at)) {
            return renderConfirmation();
        }

        return null;
    };

    return (
        <div className={`glass-card p-5 rounded-2xl ${className}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                        {t('orders.order_number')}{order.id.slice(0, 8)}
                    </div>
                    <div className="flex items-center gap-2">
                        <StatusBadge />
                        <span className="text-xs font-bold text-gray-500 capitalize px-2 py-0.5 bg-white rounded-full border border-gray-100">
                            {isMeetup ? t('orders.type_meetup') : t('orders.type_shipping')}
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-black text-lg text-gray-900">
                        ${(order.total_amount || 0).toFixed(2)} {order.currency}
                    </div>
                    <div className="text-xs text-gray-400">
                        {order.payment_method === 'cash' ? t('orders.pay_cash') : t('orders.paid_online')}
                    </div>
                </div>
            </div>

            {/* Product Snapshot - the only clickable area of the card */}
            <div
                role="link"
                tabIndex={0}
                className="flex items-center gap-4 p-3 bg-gray-50/80 rounded-xl mb-4 cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 group/product"
                onClick={handleOpenProduct}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenProduct(e as unknown as React.MouseEvent);
                    }
                }}
            >
                <div className="w-16 h-16 rounded-lg bg-white overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm flex items-center justify-center">
                    {productData?.images?.[0] ? (
                        <img src={productData.images[0]} alt={productData?.title || ''} className="w-full h-full object-cover group-hover/product:scale-105 transition-transform duration-500" />
                    ) : (
                        <Package size={28} className="text-gray-300" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate text-base mb-1">
                        {productData?.title || <span className="text-gray-400 italic">{t('orders.product_info_unavailable')}</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                        {productData?.price && <span className="bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm font-medium text-gray-700">${productData.price}</span>}
                        {order.product_id && (
                            <span className="bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm text-gray-500">
                                ID: {order.product_id.slice(0, 8)}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight size={20} className="text-gray-300 group-hover/product:text-gray-600 transition-colors" />
            </div>

            {/* Status Content */}
            {renderContent()}

            {/* Hint / Footer */}
            {(order.status === 'completed' || order.status === 'completed_pending_payout') && (
                <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl text-sm font-medium">
                    <CheckCircle size={16} />
                    {t('orders.completed_message')}
                </div>
            )}
        </div>
    );
};
