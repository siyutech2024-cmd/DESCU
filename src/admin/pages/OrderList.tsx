import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import {
    ShoppingBag,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Search as SearchIcon,
    XCircle,
    Truck
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

const OrderList: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
            completed_pending_payout: 'bg-orange-100 text-orange-800 border border-orange-200',
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
            completed_pending_payout: '待人工打款', // NEW LABEL
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

    const displayedOrders = orders.filter(o => {
        if (!searchTerm) return true;
        const low = searchTerm.toLowerCase();
        return o.id.toLowerCase().includes(low) ||
            o.products?.title?.toLowerCase().includes(low) ||
            o.buyer?.email?.toLowerCase().includes(low);
    });

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                        <ShoppingBag className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">全量订单</h1>
                        <p className="text-sm text-gray-500 font-medium">查看并管理平台所有交易</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl flex-1 max-w-sm">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="搜索订单ID、买家邮箱..."
                        className="bg-transparent border-none outline-none text-sm w-full"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-gray-50 border-none rounded-lg text-sm px-3 py-2 outline-none font-medium text-gray-700"
                    >
                        <option value="">所有状态</option>
                        <option value="pending_payment">待付款</option>
                        <option value="paid">已付款</option>
                        <option value="shipped">已发货</option>
                        <option value="completed">已完成</option>
                        <option value="completed_pending_payout">待人工打款</option>
                        <option value="disputed">纠纷中</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">订单信息</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">买家/卖家</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">金额</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">状态</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">时间</th>
                                <th className="text-right py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td>
                                </tr>
                            ) : displayedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-gray-400">无相关订单</td>
                                </tr>
                            ) : (
                                displayedOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                                    {order.products?.images?.[0] ? (
                                                        <img src={order.products.images[0]} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Img</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800 truncate max-w-[150px]">{order.products?.title || 'Unk'}</div>
                                                    <div
                                                        className="text-xs text-gray-400 font-mono cursor-pointer hover:text-brand-600 flex items-center gap-1 group/id"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(order.id);
                                                            // Could show toast here
                                                        }}
                                                        title="点击复制完整ID"
                                                    >
                                                        {order.id.slice(0, 8)}...
                                                        <span className='opacity-0 group-hover/id:opacity-100 transition-opacity'>
                                                            <SearchIcon size={10} />
                                                        </span>
                                                    </div>
                                                    {order.shipping_carrier && (
                                                        <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                            <Truck size={10} />
                                                            {order.shipping_carrier}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="text-sm">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 rounded">买</span>
                                                    <div className="text-gray-700 truncate max-w-[120px]" title={order.buyer?.email}>{order.buyer?.email || 'N/A'}</div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs bg-orange-50 text-orange-600 px-1.5 rounded">卖</span>
                                                    <div className="text-gray-500 truncate max-w-[120px]" title={order.seller?.email}>{order.seller?.email || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-gray-900">
                                                {new Intl.NumberFormat('es-MX', { style: 'currency', currency: order.currency || 'MXN' }).format(order.amount)}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {getStatusBadge(order.status)}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button
                                                className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                                title="View Details"
                                                onClick={() => setSelectedOrder(order)}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="py-4 px-6 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedOrder && (
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
                                    <div className="font-mono text-sm bg-gray-50 p-2 rounded select-all break-all">{selectedOrder.id}</div>
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
                                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: selectedOrder.currency || 'MXN' }).format(selectedOrder.amount)}
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Buyer</label>
                                    <div className="text-sm truncate" title={selectedOrder.buyer?.email}>{selectedOrder.buyer?.email}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Seller</label>
                                    <div className="text-sm truncate" title={selectedOrder.seller?.email}>{selectedOrder.seller?.email}</div>
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
                            {selectedOrder.status === 'completed_pending_payout' && (
                                <button
                                    onClick={async () => {
                                        if (confirm('确认已向卖家人工打款？订单状态将更为“已完成”。')) {
                                            try {
                                                await adminApi.markOrderAsPaid(selectedOrder.id);
                                                alert('操作成功');
                                                setSelectedOrder(null);
                                                fetchOrders(); // refresh list
                                            } catch (e) {
                                                console.error(e);
                                                alert('操作失败');
                                            }
                                        }
                                    }}
                                    className="px-5 py-2 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                                >
                                    确认已打款 (Mark Paid)
                                </button>
                            )}
                            <button onClick={() => setSelectedOrder(null)} className="px-5 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderList;
