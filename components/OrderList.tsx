import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { API_BASE_URL } from '../services/apiConfig';
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const url = `${API_BASE_URL}/api/orders?role=${role}`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const data = await res.json();
            if (res.ok) {
                setOrders(data.orders || []);
            } else {
                console.error("Orders Error:", data);
            }
        } catch (err) {
            console.error("Fetch catch error:", err);
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

            {orders.map(order => (
                <div key={order.id} className="relative group">
                    <OrderStatusCard
                        order={order}
                        currentUser={currentUser}
                        onStatusChange={fetchOrders}
                        className="hover:shadow-md transition-shadow bg-white"
                    />

                    {/* Extra Actions Overlay/Buttons appended below or overlaying */}
                    <div className="mt-2 flex gap-2 justify-end px-2">
                        {/* SELLER: Ship Button */}
                        {role === 'seller' && order.status === 'paid' && order.order_type === 'shipping' && (
                            <button
                                onClick={() => handleOpenShipModal(order.id)}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                Ship Item
                            </button>
                        )}

                        {/* BUYER: Dispute (if paid/shipped) */}
                        {role === 'buyer' && ['paid', 'shipped'].includes(order.status) && (
                            <button
                                onClick={() => { setSelectedOrderId(order.id); setShowDisputeModal(true); }}
                                className="px-3 py-2 text-red-500 text-xs hover:bg-red-50 rounded-lg transition-colors font-medium"
                            >
                                Report / Dispute
                            </button>
                        )}

                        {/* BUYER: Confirm Receipt (if shipped) */}
                        {role === 'buyer' && order.status === 'shipped' && (
                            <button
                                onClick={async () => {
                                    if (!confirm('Have you received the item and are satisfied? This will release funds to the seller.')) return;
                                    try {
                                        const { data: { session } } = await supabase.auth.getSession();
                                        const res = await fetch(`${API_BASE_URL}/api/orders/confirm`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${session?.access_token}`
                                            },
                                            body: JSON.stringify({ orderId: order.id })
                                        });
                                        if (res.ok) {
                                            alert('Order completed! Funds released.');
                                            fetchOrders();
                                        } else {
                                            const err = await res.json();
                                            alert(err.error || 'Failed to confirm');
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }}
                                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
                            >
                                Confirm Receipt
                            </button>
                        )}
                    </div>
                </div>
            ))}

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
