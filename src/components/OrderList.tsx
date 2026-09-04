import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { notify } from '@/lib/toast';
import { queryKeys } from '@/lib/queryClient';
import { useOrders } from '@/features/orders';
import { useLanguage } from '@/i18n';
import { User } from '../types';
import { OrderStatusCard } from './OrderStatusCard';
import { DisputeModal } from './DisputeModal';
import { ShipmentModal } from './ShipmentModal';
import { ConfirmSheet } from './ui/Sheet';
import { XCircle } from 'lucide-react';
import type { Order } from '../types';

interface OrderListProps {
    role: 'buyer' | 'seller';
    currentUser: User;
}

const OrderList: React.FC<OrderListProps> = ({ role, currentUser }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useLanguage();
    // Single source of truth: the shared, polled orders query (no second fetch here).
    const { orders: allOrders, isLoading } = useOrders();

    const orders = useMemo(
        () => allOrders.filter(o => (role === 'seller' ? o.seller_id === currentUser.id : o.buyer_id === currentUser.id)),
        [allOrders, role, currentUser.id]
    );

    const [showShipModal, setShowShipModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    // Two-tap confirmation (replaces the blocking `confirm()` dialog) for the irreversible receipt confirmation.
    const [armedOrderId, setArmedOrderId] = useState<string | null>(null);
    const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    // Mirrors the server rule (domain/orderStatus.cancelBlockReason): buyer cancels unpaid online
    // orders; either party cancels a cash order that has not been completed.
    const canCancel = (order: Order): boolean => {
        if (order.payment_method === 'online') return role === 'buyer' && order.status === 'pending_payment';
        return order.status === 'paid' || order.status === 'meetup_arranged';
    };

    const handleCancel = async () => {
        if (!cancelTarget) return;
        setIsCancelling(true);
        try {
            await api.post(`/api/orders/${cancelTarget.id}/cancel`, {}, { auth: 'required' });
            notify.success(t('orders.cancel_success'));
            setCancelTarget(null);
            refreshOrders();
        } catch (err) {
            notify.fromError(err, t('orders.cancel_failed'));
        } finally {
            setIsCancelling(false);
        }
    };

    const refreshOrders = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders(currentUser.id) });
    };

    const handleOpenShipModal = (orderId: string) => {
        setSelectedOrderId(orderId);
        setShowShipModal(true);
    };

    const handleConfirmReceipt = async (orderId: string) => {
        if (armedOrderId !== orderId) {
            setArmedOrderId(orderId);
            notify.info(t('orders.confirm_receipt_hint'));
            return;
        }
        setArmedOrderId(null);
        setConfirmingId(orderId);
        try {
            await api.post('/api/orders/confirm', { orderId }, { auth: 'required' });
            notify.success(t('orders.confirm_success'));
            refreshOrders();
        } catch (err) {
            notify.fromError(err, t('orders.confirm_failed'));
        } finally {
            setConfirmingId(null);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">{t('orders.loading')}</div>;

    return (
        <div className="space-y-4">
            {orders.length === 0 && <div className="text-center text-gray-500 py-8">{t('orders.empty')}</div>}

            {orders.map(order => {
                const productId = order.product_id || (order.product as any)?.id;

                return (
                    <div key={order.id} className="relative group">
                        <OrderStatusCard
                            order={order}
                            currentUser={currentUser}
                            onStatusChange={refreshOrders}
                            onOpenProduct={() => {
                                if (productId) {
                                    navigate(`/product/${productId}`);
                                } else {
                                    notify.error(t('orders.product_unavailable'));
                                }
                            }}
                            className="hover:shadow-md transition-shadow bg-white"
                        />

                        {/* Extra actions (not part of the clickable product area) */}
                        <div className="mt-2 flex gap-2 justify-end px-2">
                            {canCancel(order) && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setCancelTarget(order); }}
                                    className="px-3 py-2 text-gray-500 text-xs hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                >
                                    {t('orders.cancel')}
                                </button>
                            )}

                            {/* SELLER: Ship Button */}
                            {role === 'seller' && (order.status === 'paid' || order.status === 'escrow_held') && order.order_type === 'shipping' && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleOpenShipModal(order.id); }}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    {t('orders.ship_item')}
                                </button>
                            )}

                            {/* BUYER: Dispute (if paid/shipped) */}
                            {role === 'buyer' && ['paid', 'escrow_held', 'meetup_arranged', 'shipped'].includes(order.status) && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedOrderId(order.id); setShowDisputeModal(true); }}
                                    className="px-3 py-2 text-red-500 text-xs hover:bg-red-50 rounded-lg transition-colors font-medium"
                                >
                                    {t('orders.dispute')}
                                </button>
                            )}

                            {/* BUYER: Confirm Receipt (if shipped) */}
                            {role === 'buyer' && order.status === 'shipped' && (
                                <button
                                    type="button"
                                    disabled={confirmingId === order.id}
                                    onClick={(e) => { e.stopPropagation(); handleConfirmReceipt(order.id); }}
                                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium disabled:opacity-60"
                                >
                                    {confirmingId === order.id
                                        ? t('orders.confirming')
                                        : armedOrderId === order.id
                                            ? t('orders.confirm_receipt_again')
                                            : t('orders.confirm_receipt')}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            <ShipmentModal
                isOpen={showShipModal}
                orderId={selectedOrderId || ''}
                onClose={() => setShowShipModal(false)}
                onSuccess={refreshOrders}
            />

            <DisputeModal
                isOpen={showDisputeModal}
                orderId={selectedOrderId || ''}
                onClose={() => setShowDisputeModal(false)}
                onSuccess={refreshOrders}
            />

            <ConfirmSheet
                open={cancelTarget !== null}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleCancel}
                busy={isCancelling}
                destructive
                icon={<XCircle size={20} />}
                title={t('orders.cancel_confirm_title')}
                description={cancelTarget?.payment_method === 'online' ? t('orders.cancel_confirm_body_unpaid') : t('orders.cancel_confirm_body_cash')}
                confirmLabel={t('orders.cancel')}
                cancelLabel={t('orders.cancel_keep')}
            />
        </div>
    );
};

export default OrderList;
