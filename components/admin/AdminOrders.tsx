import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../services/apiConfig';
import { supabase } from '../../services/supabase';
import { Loader2, Search, Filter, Eye, CheckCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const AdminOrders: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchOrders();
    }, [page, filterStatus]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '20'
            });
            if (filterStatus) queryParams.append('status', filterStatus);

            const res = await fetch(`${API_BASE_URL}/api/admin/orders?${queryParams}`, {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders);
                setTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error('Failed to fetch orders', error);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPaid = async (orderId: string) => {
        if (!confirm('Are you sure you want to mark this order as manually paid? This action cannot be undone.')) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE_URL}/api/admin/orders/${orderId}/mark-paid`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ notes: 'Marked paid by admin manual action' })
            });

            if (res.ok) {
                toast.success('Order marked as paid');
                fetchOrders();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Action failed');
            }
        } catch (error) {
            toast.error('Network error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800">Transaction Management</h2>

                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="pending_payment">Pending Payment</option>
                        <option value="paid">Paid</option>
                        <option value="shipped">Shipped</option>
                        <option value="completed">Completed</option>
                        <option value="disputed">Disputed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Order ID</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Buyer / Seller</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-500" /></td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No orders found</td></tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-gray-500 text-xs">
                                            {order.id.slice(0, 8)}...
                                            <div className="text-[10px] text-gray-400">{new Date(order.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={order.products?.images?.[0]} className="w-8 h-8 rounded object-cover bg-gray-100" />
                                                <span className="font-medium text-gray-900 truncate max-w-[150px]">{order.products?.title || 'Unknown Product'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            ${order.total_amount} <span className="text-gray-400 text-xs">{order.currency}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <div className="text-gray-900">B: {order.buyer?.email}</div>
                                            <div className="text-gray-500">S: {order.seller?.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                order.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                                                    order.status === 'disputed' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-600'
                                                }`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {order.status === 'completed_pending_payout' && (
                                                    <button
                                                        onClick={() => handleMarkPaid(order.id)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Mark as Paid Manually"
                                                    >
                                                        <DollarSign size={16} />
                                                    </button>
                                                )}
                                                <button className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
                                                    <Eye size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-gray-100 flex justify-between items-center">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-500">Page {page} of {totalPages || 1}</span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};


