import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import {
    ShoppingBag,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Clock,
    CheckCircle,
    AlertCircle,
    XCircle,
    Truck,
    CreditCard
} from 'lucide-react';

interface Order {
    id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    updated_at: string;
    products: {
        title: string;
        images: string[];
    };
    buyer: {
        email: string;
    };
    seller: {
        email: string;
    };
    payment_intent_id?: string;
    shipping_carrier?: string;
    tracking_number?: string;
}

export const OrderList: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getOrders({
                page,
                limit: 15,
                status: statusFilter || undefined
            });

            if (res.data) {
                const data = res.data as any;
                setOrders(data.orders || []);
                setTotalPages(data.totalPages || 1);
            } else if (res.error) {
                console.error("Fetch orders failed:", res.error);
                // alert(res.error); // Optional: show toast
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending_payment: 'bg-yellow-100 text-yellow-800',
            paid: 'bg-blue-100 text-blue-800',
            shipped: 'bg-indigo-100 text-indigo-800',
            completed: 'bg-green-100 text-green-800',
            disputed: 'bg-red-100 text-red-800',
            resolved_refund: 'bg-gray-100 text-gray-800',
            resolved_release: 'bg-green-100 text-green-800',
            refunded: 'bg-gray-200 text-gray-700',
            cancelled: 'bg-red-50 text-red-600'
        };

        const labels: Record<string, string> = {
            pending_payment: '待付款',
            paid: '已付款(待发货)',
            shipped: '已发货',
            completed: '已完成',
            disputed: '纠纷中',
            resolved_refund: '已退款(纠纷)',
            resolved_release: '已放款(纠纷)',
            refunded: '已退款',
            cancelled: '已取消'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100'}`}>
                {labels[status] || status}
            </span>
        );
    };

    // Filter displayed orders by search term (local filter for now as API might not support flexible search yet)
    // Ideally backend should handle search
    const displayedOrders = orders; // .filter(...) if needed

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // ... inside map
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                {/* ... img ... */}
                                                <div>
                                                    <div className="font-bold text-gray-800 truncate max-w-[150px]">{order.products?.title || 'Unk'}</div>
                                                    <div 
                                                        className="text-xs text-gray-400 font-mono cursor-pointer hover:text-brand-600 flex items-center gap-1"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(order.id);
                                                            // toast.success('ID Copied');
                                                        }}
                                                        title="Click to copy full ID"
                                                    >
                                                        {order.id.slice(0, 8)}...
                                                        <Search size={10} />
                                                    </div>
                                                    {/* ... */}
                                                </div>
                                            </div>
                                        </td>
    
    // ... inside actions
                                        <td className="py-4 px-6 text-right">
                                            <button
                                                className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                                title="View Details"
                                                onClick={() => setSelectedOrder(order)}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </td>

    // ... after table (before closing div)
    {/* Detail Modal */ }
    {
        selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                        <h2 className="text-xl font-black text-gray-800">Order Details</h2>
                        <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-full">
                            <XCircle size={24} className="text-gray-400" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Order ID</label>
                                <div className="font-mono text-sm bg-gray-50 p-2 rounded select-all">{selectedOrder.id}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Created At</label>
                                <div className="text-sm">{new Date(selectedOrder.created_at).toLocaleString()}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                                <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Product</label>
                                <div className="text-sm font-bold">{selectedOrder.products?.title}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Amount</label>
                                <div className="text-lg font-black text-brand-600">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: selectedOrder.currency }).format(selectedOrder.amount)}
                                </div>
                            </div>
                        </div>

                        <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Buyer</label>
                                <div className="text-sm truncate">{selectedOrder.buyer?.email}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Seller</label>
                                <div className="text-sm truncate">{selectedOrder.seller?.email}</div>
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Payment Intent ID</label>
                            <div className="font-mono text-xs bg-gray-100 p-2 rounded text-gray-600 break-all select-all">
                                {selectedOrder.payment_intent_id || 'N/A'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button onClick={() => setSelectedOrder(null)} className="px-5 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )
    }
        </div >
    );
};

export default OrderList;
