import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
// import { useAuth } from '../contexts/AuthContext'; // Removed unused context
import { Package, Truck, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { DisputeModal } from './DisputeModal';

interface Order {
    id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    products: {
        title: string;
        images: string[];
    };
    shipping_carrier?: string;
    tracking_number?: string;
}

interface OrderListProps {
    role: 'buyer' | 'seller';
}

const OrderList: React.FC<OrderListProps> = ({ role }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Ship Modal State
    const [showShipModal, setShowShipModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [carrier, setCarrier] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [role]);

    const fetchOrders = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/orders?role=${role}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const data = await res.json();
            if (res.ok) {
                setOrders(data.orders || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReceipt = async (orderId: string) => {
        if (!window.confirm('确认收到货物且无误？资金将放款给卖家。')) return;

        setActionLoading(orderId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/orders/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ orderId })
            });

            if (res.ok) {
                fetchOrders(); // Refresh
                alert('交易完成！');
            } else {
                const err = await res.json();
                alert(`失败: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    };

    const handleOpenShipModal = (orderId: string) => {
        setSelectedOrderId(orderId);
        setShowShipModal(true);
    };

    const handleOpenDispute = (orderId: string) => {
        setSelectedOrderId(orderId);
        setShowDisputeModal(true);
    };

    const submitShip = async () => {
        if (!selectedOrderId || !carrier || !trackingNumber) return alert('请填写完整物流信息');

        setActionLoading(selectedOrderId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/orders/ship`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    orderId: selectedOrderId,
                    carrier,
                    trackingNumber
                })
            });

            if (res.ok) {
                setShowShipModal(false);
                setCarrier('');
                setTrackingNumber('');
                fetchOrders();
                alert('发货成功！');
            } else {
                const err = await res.json();
                alert(`失败: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending_payment': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs flex items-center gap-1"><Clock size={12} /> 待付款</span>;
            case 'paid': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center gap-1"><Package size={12} /> 待发货</span>;
            case 'shipped': return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs flex items-center gap-1"><Truck size={12} /> 已发货</span>;
            case 'completed': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs flex items-center gap-1"><CheckCircle size={12} /> 已完成</span>;
            case 'disputed': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs flex items-center gap-1"><AlertCircle size={12} /> 纠纷中</span>;
            case 'resolved_refund': return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">已退款</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{status}</span>;
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

    return (
        <div className="space-y-4">
            {orders.length === 0 && <div className="text-center text-gray-500 py-8">暂无订单</div>}

            {orders.map(order => (
                <div key={order.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                {order.products?.images?.[0] ? (
                                    <img src={order.products.images[0]} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300">No Img</div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900">{order.products?.title || 'Unknown Product'}</h3>
                                <p className="text-sm text-gray-500 mt-1">Order ID: ...{order.id.slice(-6)}</p>
                                <p className="font-semibold text-brand-600 mt-1">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: order.currency || 'MXN' }).format(order.amount)}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(order.status)}
                            <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Actions Area */}
                    <div className="border-t border-gray-50 pt-3 flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            {order.status === 'shipped' && (
                                <div className="flex items-center gap-2">
                                    <Truck size={14} />
                                    <span>物流: {order.shipping_carrier} ({order.tracking_number})</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {/* SELLER ACTIONS */}
                            {role === 'seller' && order.status === 'paid' && (
                                <button
                                    onClick={() => handleOpenShipModal(order.id)}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    立即发货 (Ship Item)
                                </button>
                            )}

                            {/* BUYER ACTIONS */}
                            {role === 'buyer' && order.status === 'shipped' && (
                                <button
                                    onClick={() => handleConfirmReceipt(order.id)}
                                    disabled={actionLoading === order.id}
                                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {actionLoading === order.id ? 'Processing...' : '确认收货 (Confirm Receipt)'}
                                </button>
                            )}

                            {role === 'buyer' && ['paid', 'shipped'].includes(order.status) && (
                                <button
                                    onClick={() => handleOpenDispute(order.id)}
                                    className="px-3 py-2 text-red-500 text-xs hover:bg-red-50 rounded-lg transition-colors font-medium border border-transparent hover:border-red-100"
                                >
                                    申请纠纷 (Report)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* Ship Modal */}
            {showShipModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">填写发货信息</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">物流公司 (Carrier)</label>
                                <select
                                    value={carrier}
                                    onChange={e => setCarrier(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2"
                                >
                                    <option value="">请选择...</option>
                                    <option value="DHL">DHL</option>
                                    <option value="FedEx">FedEx</option>
                                    <option value="Estafeta">Estafeta</option>
                                    <option value="Correos de Mexico">Correos de Mexico</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">物流单号 (Tracking Number)</label>
                                <input
                                    type="text"
                                    value={trackingNumber}
                                    onChange={e => setTrackingNumber(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2"
                                    placeholder="例如: 1234567890"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowShipModal(false)}
                                className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-xl"
                            >
                                取消
                            </button>
                            <button
                                onClick={submitShip}
                                disabled={!!actionLoading}
                                className="flex-1 py-2 bg-black text-white font-medium rounded-xl hover:bg-gray-800"
                            >
                                {actionLoading ? '提交中...' : '确认发货'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
