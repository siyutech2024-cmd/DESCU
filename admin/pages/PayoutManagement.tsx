import React, { useState, useEffect } from 'react';
import {
    Banknote,
    Search,
    Filter,
    ChevronRight,
    Copy,
    Check,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertCircle
} from 'lucide-react';

interface PayoutOrder {
    id: string;
    total_amount: number;
    platform_fee: number;
    payoutAmount: number;
    status: string;
    payout_status: string;
    payout_at: string | null;
    payout_reference: string | null;
    created_at: string;
    completed_at: string;
    products: {
        id: string;
        title: string;
        images: string[];
    };
    seller: {
        id: string;
        name: string;
        email: string;
        sellers: Array<{
            bank_clabe: string;
            bank_name: string;
            bank_holder_name: string;
        }>;
    };
    sellerBank: {
        bank_clabe: string;
        bank_name: string;
        bank_holder_name: string;
    } | null;
}

interface PayoutStats {
    pending: number;
    processing: number;
    completed: number;
    totalPendingAmount: number;
}

const PayoutManagement: React.FC = () => {
    const [payouts, setPayouts] = useState<PayoutOrder[]>([]);
    const [stats, setStats] = useState<PayoutStats>({ pending: 0, processing: 0, completed: 0, totalPendingAmount: 0 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPayout, setSelectedPayout] = useState<PayoutOrder | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [referenceInput, setReferenceInput] = useState('');

    useEffect(() => {
        fetchPayouts();
    }, [statusFilter]);

    const fetchPayouts = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`/api/admin/payouts?status=${statusFilter}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setPayouts(data.payouts || []);
                setStats(data.stats || { pending: 0, processing: 0, completed: 0, totalPendingAmount: 0 });
            }
        } catch (err) {
            console.error('Fetch payouts error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyClabe = (clabe: string) => {
        navigator.clipboard.writeText(clabe);
        setCopiedId(clabe);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleMarkComplete = async (orderId: string) => {
        if (!confirm('确认已通过银行转账完成打款？')) return;

        setActionLoading(true);
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`/api/admin/payouts/${orderId}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reference: referenceInput })
            });

            if (res.ok) {
                setSelectedPayout(null);
                setReferenceInput('');
                fetchPayouts();
            } else {
                alert('操作失败');
            }
        } catch (err) {
            console.error('Complete payout error:', err);
            alert('操作失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkProcessing = async (orderId: string) => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`/api/admin/payouts/${orderId}/processing`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchPayouts();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
            processing: 'bg-blue-100 text-blue-800 border border-blue-200',
            completed: 'bg-green-100 text-green-800 border border-green-200',
            failed: 'bg-red-100 text-red-800 border border-red-200'
        };

        const labels: Record<string, string> = {
            pending: '待转账',
            processing: '处理中',
            completed: '已到账',
            failed: '失败'
        };

        const icons: Record<string, React.ReactNode> = {
            pending: <Clock size={12} />,
            processing: <Loader2 size={12} className="animate-spin" />,
            completed: <CheckCircle2 size={12} />,
            failed: <XCircle size={12} />
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${styles[status] || styles.pending}`}>
                {icons[status] || icons.pending}
                {labels[status] || labels.pending}
            </span>
        );
    };

    const filteredPayouts = payouts.filter(p => {
        if (!searchTerm) return true;
        const low = searchTerm.toLowerCase();
        return p.id.toLowerCase().includes(low) ||
            p.seller?.name?.toLowerCase().includes(low) ||
            p.seller?.email?.toLowerCase().includes(low) ||
            p.products?.title?.toLowerCase().includes(low);
    });

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-200">
                        <Banknote className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">转账管理</h1>
                        <p className="text-sm text-gray-500 font-medium">管理卖家收款转账</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                    onClick={() => setStatusFilter('pending')}
                    className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${statusFilter === 'pending' ? 'border-yellow-400 shadow-lg shadow-yellow-100' : 'border-gray-100 hover:border-gray-200'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">待转账</span>
                        <Clock size={16} className="text-yellow-500" />
                    </div>
                    <div className="text-2xl font-black text-gray-800">{stats.pending}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        ${stats.totalPendingAmount.toLocaleString('es-MX')} MXN
                    </div>
                </div>

                <div
                    onClick={() => setStatusFilter('processing')}
                    className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${statusFilter === 'processing' ? 'border-blue-400 shadow-lg shadow-blue-100' : 'border-gray-100 hover:border-gray-200'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">处理中</span>
                        <Loader2 size={16} className="text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-gray-800">{stats.processing}</div>
                </div>

                <div
                    onClick={() => setStatusFilter('completed')}
                    className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${statusFilter === 'completed' ? 'border-green-400 shadow-lg shadow-green-100' : 'border-gray-100 hover:border-gray-200'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">已完成</span>
                        <CheckCircle2 size={16} className="text-green-500" />
                    </div>
                    <div className="text-2xl font-black text-gray-800">{stats.completed}</div>
                </div>

                <div
                    onClick={() => setStatusFilter('all')}
                    className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${statusFilter === 'all' ? 'border-purple-400 shadow-lg shadow-purple-100' : 'border-gray-100 hover:border-gray-200'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">全部</span>
                        <Banknote size={16} className="text-purple-500" />
                    </div>
                    <div className="text-2xl font-black text-gray-800">{stats.pending + stats.processing + stats.completed}</div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl flex-1 max-w-sm">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="搜索订单、卖家..."
                        className="bg-transparent border-none outline-none text-sm w-full"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Payouts List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">订单/商品</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">卖家</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">银行信息</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">金额</th>
                                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">状态</th>
                                <th className="text-right py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center">
                                        <Loader2 className="w-8 h-8 text-gray-300 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : filteredPayouts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-gray-400">
                                        暂无{statusFilter === 'pending' ? '待转账' : ''}订单
                                    </td>
                                </tr>
                            ) : (
                                filteredPayouts.map(payout => (
                                    <tr key={payout.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                                    {payout.products?.images?.[0] ? (
                                                        <img src={payout.products.images[0]} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">N/A</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800 truncate max-w-[150px]">
                                                        {payout.products?.title || 'Unknown'}
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono">
                                                        {payout.id.slice(0, 8)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-medium text-gray-800">{payout.seller?.name || 'N/A'}</div>
                                            <div className="text-xs text-gray-400">{payout.seller?.email}</div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {payout.sellerBank ? (
                                                <div>
                                                    <div className="text-sm font-medium text-gray-700">{payout.sellerBank.bank_name}</div>
                                                    <button
                                                        onClick={() => handleCopyClabe(payout.sellerBank!.bank_clabe)}
                                                        className="text-xs font-mono text-gray-500 hover:text-brand-600 flex items-center gap-1"
                                                    >
                                                        {payout.sellerBank.bank_clabe.slice(0, 6)}...{payout.sellerBank.bank_clabe.slice(-4)}
                                                        {copiedId === payout.sellerBank.bank_clabe ? (
                                                            <Check size={12} className="text-green-500" />
                                                        ) : (
                                                            <Copy size={12} />
                                                        )}
                                                    </button>
                                                    <div className="text-xs text-gray-400">{payout.sellerBank.bank_holder_name}</div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-orange-500 text-sm">
                                                    <AlertCircle size={14} />
                                                    未配置
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-gray-900">
                                                ${payout.payoutAmount?.toLocaleString('es-MX')}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                原价 ${payout.total_amount?.toLocaleString('es-MX')}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {getStatusBadge(payout.payout_status || 'pending')}
                                            {payout.payout_at && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {new Date(payout.payout_at).toLocaleDateString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button
                                                onClick={() => setSelectedPayout(payout)}
                                                className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
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
            </div>

            {/* Detail Modal */}
            {selectedPayout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPayout(null)}>
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-black text-gray-800">转账详情</h2>
                            <button onClick={() => setSelectedPayout(null)} className="p-2 hover:bg-gray-100 rounded-full">
                                <XCircle size={24} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Amount */}
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 rounded-xl text-white">
                                <div className="text-sm opacity-80">转账金额</div>
                                <div className="text-3xl font-black">${selectedPayout.payoutAmount?.toLocaleString('es-MX')} MXN</div>
                            </div>

                            {/* Seller Info */}
                            <div className="bg-gray-50 p-4 rounded-xl">
                                <div className="text-xs font-bold text-gray-400 uppercase mb-2">卖家信息</div>
                                <div className="font-medium text-gray-800">{selectedPayout.seller?.name}</div>
                                <div className="text-sm text-gray-500">{selectedPayout.seller?.email}</div>
                            </div>

                            {/* Bank Info */}
                            {selectedPayout.sellerBank ? (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="text-xs font-bold text-blue-600 uppercase mb-2">银行账户</div>
                                    <div className="font-medium text-gray-800">{selectedPayout.sellerBank.bank_name}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <code className="text-lg font-mono text-gray-800 bg-white px-3 py-1 rounded">
                                            {selectedPayout.sellerBank.bank_clabe}
                                        </code>
                                        <button
                                            onClick={() => handleCopyClabe(selectedPayout.sellerBank!.bank_clabe)}
                                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                        >
                                            {copiedId === selectedPayout.sellerBank.bank_clabe ? (
                                                <Check size={18} className="text-green-500" />
                                            ) : (
                                                <Copy size={18} className="text-blue-500" />
                                            )}
                                        </button>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">{selectedPayout.sellerBank.bank_holder_name}</div>
                                </div>
                            ) : (
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                    <div className="flex items-center gap-2 text-orange-600">
                                        <AlertCircle size={18} />
                                        <span className="font-medium">卖家未配置银行账户</span>
                                    </div>
                                </div>
                            )}

                            {/* Reference Input */}
                            {(selectedPayout.payout_status === 'pending' || !selectedPayout.payout_status) && selectedPayout.sellerBank && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">
                                        转账参考号 (可选)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="SPEI 参考号..."
                                        value={referenceInput}
                                        onChange={e => setReferenceInput(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex gap-3">
                            {(selectedPayout.payout_status === 'pending' || !selectedPayout.payout_status) && selectedPayout.sellerBank && (
                                <>
                                    <button
                                        onClick={() => handleMarkProcessing(selectedPayout.id)}
                                        disabled={actionLoading}
                                        className="flex-1 px-4 py-3 rounded-xl font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                    >
                                        标记处理中
                                    </button>
                                    <button
                                        onClick={() => handleMarkComplete(selectedPayout.id)}
                                        disabled={actionLoading}
                                        className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading && <Loader2 size={16} className="animate-spin" />}
                                        确认已转账
                                    </button>
                                </>
                            )}
                            {selectedPayout.payout_status === 'processing' && (
                                <button
                                    onClick={() => handleMarkComplete(selectedPayout.id)}
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {actionLoading && <Loader2 size={16} className="animate-spin" />}
                                    确认已转账
                                </button>
                            )}
                            {selectedPayout.payout_status === 'completed' && (
                                <div className="flex-1 px-4 py-3 rounded-xl font-bold text-green-600 bg-green-50 text-center">
                                    ✓ 已完成转账 {selectedPayout.payout_reference && `(${selectedPayout.payout_reference})`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayoutManagement;
