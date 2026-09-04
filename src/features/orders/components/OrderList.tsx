import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { notify } from '@/lib/toast';
import { queryKeys } from '@/lib/queryClient';
import { useOrders } from '@/features/orders';
import { useLanguage } from '@/i18n';
import { User } from '@/types';
import { OrderStatusCard } from './OrderStatusCard';
import { DisputeModal } from './DisputeModal';
import { ShipmentModal } from './ShipmentModal';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { XCircle, Truck, ShoppingBag } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui/primitives';
import type { Order } from '@/types';

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

    if (isLoading) return <p className="p-8 text-center text-sm text-gray-500">{t('orders.loading')}</p>;

    return (
        <div className="space-y-3">
            {orders.length === 0 && <EmptyState icon={<ShoppingBag size={26} />} title={t('orders.empty')} className="bg-white rounded-2xl border border-gray-100" />}

            {orders.map(order => {
                const productId = order.product_id || (order.product as any)?.id;
                const actions: React.ReactNode[] = [];
                if (canCancel(order)) {
                    actions.push(<Button key="cancel" size="sm" variant="ghost" className="text-gray-500" onClick={() => setCancelTarget(order)}>{t('orders.cancel')}</Button>);
                }
                if (role === 'buyer' && ['paid', 'escrow_held', 'meetup_arranged', 'shipped'].includes(order.status)) {
                    actions.push(<Button key="dispute" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => { setSelectedOrderId(order.id); setShowDisputeModal(true); }}>{t('orders.dispute')}</Button>);
                }
                if (role === 'seller' && (order.status === 'paid' || order.status === 'escrow_held') && order.order_type === 'shipping') {
                    actions.push(<Button key="ship" size="sm" icon={<Truck size={16} />} onClick={() => handleOpenShipModal(order.id)}>{t('orders.ship_item')}</Button>);
                }
                if (role === 'buyer' && order.status === 'shipped') {
                    actions.push(
                        <Button key="confirm" size="sm" variant={armedOrderId === order.id ? 'danger' : 'primary'} loading={confirmingId === order.id} onClick={() => handleConfirmReceipt(order.id)}>
                            {armedOrderId === order.id ? t('orders.confirm_receipt_again') : t('orders.confirm_receipt')}
                        </Button>,
                    );
                }
                return (
                    <OrderStatusCard
                        key={order.id}
                        order={order}
                        currentUser={currentUser}
                        onStatusChange={refreshOrders}
                        onOpenProduct={() => { if (productId) navigate(`/product/${productId}`); else notify.error(t('orders.product_unavailable')); }}
                        actions={actions.length > 0 ? actions : undefined}
                    />
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
