import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api/client';
import { Order, User } from '../types';
import { OrderStatusCard } from './OrderStatusCard';
import { DisputeModal } from './DisputeModal';
import { ShipmentModal } from './ShipmentModal';

interface OrderListProps {
    role: 'buyer' | 'seller';
    currentUser: User;
}

const OrderList: React.FC<OrderListProps> = ({ role, currentUser }) => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Ship Modal State
    const [showShipModal, setShowShipModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser) {
            fetchOrders();
        }
    }, [role, currentUser]);

    const fetchOrders = async () => {
        try {
            const data = await api.get<{ orders?: Order[] }>('/api/orders', {
                params: { role },
                auth: 'required'
            });
            setOrders(data.orders || []);
        } catch (err) {
            if (err instanceof ApiError) {
                console.error("Orders Error:", err.body);
            } else {
                console.error("Fetch catch error:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpenShipModal = (orderId: string) => {
        setSelectedOrderId(orderId);
        setShowShipModal(true);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading orders...</div>;

    return (
        <div className="space-y-4">
            {orders.length === 0 && <div className="text-center text-gray-500 py-8">No orders found.</div>}

            {orders.map(order => {
                // Debug: Log order structure to find correct product_id field
                console.log('[OrderList] Order:', order.id, 'product_id:', order.product_id, 'product:', order.product);

                // Get product_id from different possible sources
                const productId = order.product_id || (order.product as any)?.id;

                return (
                    <div
                        key={order.id}
                        className="relative group cursor-pointer hover:scale-[1.01] transition-transform"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('[OrderList] Clicked order:', order.id, 'productId:', productId);
                            if (productId) {
                                // Use direct navigation instead of React Router's navigate
                                console.log('[OrderList] Navigating to:', `/product/${productId}`);
                                window.location.href = `/product/${productId}`;
                            } else {
                                console.warn('No product_id for order:', order.id, 'Full order:', order);
                                alert('无法查看产品详情 / No se puede ver el producto');
                            }
                        }}
                    >
                        <OrderStatusCard
                            order={order}
                            currentUser={currentUser}
                            onStatusChange={fetchOrders}
                            className="hover:shadow-md transition-shadow bg-white"
                        />

                        {/* Extra Actions Overlay/Buttons appended below or overlaying */}
                        <div className="mt-2 flex gap-2 justify-end px-2" onClick={(e) => e.stopPropagation()}>
                            {/* SELLER: Ship Button */}
                            {role === 'seller' && order.status === 'paid' && order.order_type === 'shipping' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenShipModal(order.id); }}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Ship Item
                                </button>
                            )}

                            {/* BUYER: Dispute (if paid/shipped) */}
                            {role === 'buyer' && ['paid', 'shipped'].includes(order.status) && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedOrderId(order.id); setShowDisputeModal(true); }}
                                    className="px-3 py-2 text-red-500 text-xs hover:bg-red-50 rounded-lg transition-colors font-medium"
                                >
                                    Report / Dispute
                                </button>
                            )}

                            {/* BUYER: Confirm Receipt (if shipped) */}
                            {role === 'buyer' && order.status === 'shipped' && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!confirm('Have you received the item and are satisfied? This will release funds to the seller.')) return;
                                        try {
                                            await api.post('/api/orders/confirm', { orderId: order.id }, { auth: 'optional' });
                                            alert('Order completed! Funds released.');
                                            fetchOrders();
                                        } catch (e) {
                                            if (e instanceof ApiError) {
                                                const err = e.body as any;
                                                alert(err?.error || 'Failed to confirm');
                                            } else {
                                                console.error(e);
                                            }
                                        }
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
                                >
                                    Confirm Receipt
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Ship Modal */}
            <ShipmentModal
                isOpen={showShipModal}
                orderId={selectedOrderId || ''}
                onClose={() => setShowShipModal(false)}
                onSuccess={() => {
                    fetchOrders();
                }}
            />

            {/* Dispute Modal */}
            <DisputeModal
                isOpen={showDisputeModal}
                orderId={selectedOrderId || ''}
                onClose={() => setShowDisputeModal(false)}
                onSuccess={() => {
                    fetchOrders();
                }}
            />
        </div>
    );
};

export default OrderList;
