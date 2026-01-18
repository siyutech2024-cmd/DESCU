import React, { useState, useEffect } from 'react';
import {
    Banknote,
    Loader2,
    Check,
    Clock,
    ChevronDown,
    ChevronUp,
    Wallet,
    Building2,
    Edit3
} from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';
import { supabase } from '../services/supabase';

interface SellerPayoutCardProps {
    userId: string;
}

interface PayoutItem {
    id: string;
    total_amount: number;
    payoutAmount: number;
    status: string;
    payout_at: string | null;
    completed_at: string;
    products: {
        title: string;
        images: string[];
    };
}

interface PayoutSummary {
    totalEarned: number;
    pending: number;
    completed: number;
}

interface BankInfo {
    bank_clabe: string;
    bank_name: string;
    bank_holder_name: string;
}

export const SellerPayoutCard: React.FC<SellerPayoutCardProps> = ({ userId }) => {
    const [payouts, setPayouts] = useState<PayoutItem[]>([]);
    const [summary, setSummary] = useState<PayoutSummary>({ totalEarned: 0, pending: 0, completed: 0 });
    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const [editingBank, setEditingBank] = useState(false);
    const [bankForm, setBankForm] = useState({ clabe: '', bankName: '', holderName: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Fetch payouts
            const payoutsRes = await fetch(`${API_BASE_URL}/api/users/payouts`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (payoutsRes.ok) {
                const data = await payoutsRes.json();
                setPayouts(data.payouts || []);
                setSummary(data.summary || { totalEarned: 0, pending: 0, completed: 0 });
            }

            // Fetch bank info
            const { data: seller } = await supabase
                .from('sellers')
                .select('bank_clabe, bank_name, bank_holder_name')
                .eq('user_id', userId)
                .single();

            if (seller?.bank_clabe) {
                setBankInfo({
                    bank_clabe: seller.bank_clabe,
                    bank_name: seller.bank_name || '',
                    bank_holder_name: seller.bank_holder_name || ''
                });
                setBankForm({
                    clabe: seller.bank_clabe,
                    bankName: seller.bank_name || '',
                    holderName: seller.bank_holder_name || ''
                });
            }
        } catch (err) {
            console.error('Fetch payout data error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBank = async () => {
        if (!bankForm.clabe || bankForm.clabe.length !== 18) {
            alert('CLABE 必须是 18 位数字 / CLABE debe tener 18 dígitos');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('sellers')
                .upsert({
                    user_id: userId,
                    bank_clabe: bankForm.clabe,
                    bank_name: bankForm.bankName,
                    bank_holder_name: bankForm.holderName
                }, { onConflict: 'user_id' });

            if (error) throw error;

            setBankInfo({
                bank_clabe: bankForm.clabe,
                bank_name: bankForm.bankName,
                bank_holder_name: bankForm.holderName
            });
            setEditingBank(false);
        } catch (err) {
            console.error('Save bank info error:', err);
            alert('保存失败 / Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <Check size={14} className="text-green-500" />;
            case 'processing':
                return <Loader2 size={14} className="text-blue-500 animate-spin" />;
            default:
                return <Clock size={14} className="text-yellow-500" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return '已到账 / Recibido';
            case 'processing': return '处理中 / Procesando';
            default: return '待转账 / Pendiente';
        }
    };

    if (loading) {
        return (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 mb-4 shadow-lg">
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={32} className="text-white animate-spin" />
                </div>
            </div>
        );
    }

    const displayPayouts = showAll ? payouts : payouts.slice(0, 3);
    const showBankForm = editingBank || !bankInfo;

    return (
        <div className="space-y-4 mb-4">
            {/* Summary Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            <Wallet size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">收款管理 / Ingresos</h2>
                            <p className="text-emerald-100 text-sm">Gestiona tus pagos</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-emerald-100 text-xs">总收入 / Total</p>
                            <p className="text-white font-bold text-lg">${summary.totalEarned.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-yellow-200 text-xs flex items-center gap-1">
                                <Clock size={10} /> 待转账
                            </p>
                            <p className="text-white font-bold text-lg">${summary.pending.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-green-200 text-xs flex items-center gap-1">
                                <Check size={10} /> 已到账
                            </p>
                            <p className="text-white font-bold text-lg">${summary.completed.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bank Info Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Building2 size={18} className="text-gray-600" />
                        <span className="font-bold text-gray-800">银行账户 / Cuenta Bancaria</span>
                    </div>
                    {bankInfo && !editingBank && (
                        <button
                            onClick={() => setEditingBank(true)}
                            className="text-emerald-600 text-sm font-medium flex items-center gap-1"
                        >
                            <Edit3 size={14} />
                            编辑 / Editar
                        </button>
                    )}
                </div>

                {showBankForm ? (
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-gray-500">CLABE (18 位数字 / dígitos)</label>
                                <span className={`text-xs font-mono ${bankForm.clabe.length === 18 ? 'text-green-500' : 'text-gray-400'}`}>
                                    {bankForm.clabe.length}/18
                                </span>
                            </div>
                            <input
                                type="text"
                                value={bankForm.clabe}
                                onChange={e => setBankForm({ ...bankForm, clabe: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                                placeholder="输入 18 位 CLABE 号码"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono text-lg tracking-wider"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">银行名称 / Banco</label>
                                <input
                                    type="text"
                                    value={bankForm.bankName}
                                    onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                                    placeholder="BBVA, Santander..."
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">持有人姓名 / Titular</label>
                                <input
                                    type="text"
                                    value={bankForm.holderName}
                                    onChange={e => setBankForm({ ...bankForm, holderName: e.target.value })}
                                    placeholder="Nombre completo"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSaveBank}
                            disabled={saving || bankForm.clabe.length !== 18}
                            className={`w-full font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${bankForm.clabe.length === 18
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {saving && <Loader2 size={16} className="animate-spin" />}
                            {bankForm.clabe.length === 18 ? '保存 / Guardar' : `还需输入 ${18 - bankForm.clabe.length} 位`}
                        </button>
                        {bankInfo && (
                            <button
                                onClick={() => {
                                    setEditingBank(false);
                                    setBankForm({
                                        clabe: bankInfo.bank_clabe,
                                        bankName: bankInfo.bank_name,
                                        holderName: bankInfo.bank_holder_name
                                    });
                                }}
                                className="w-full text-gray-500 text-sm py-2"
                            >
                                取消 / Cancelar
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-800">{bankInfo!.bank_name || 'Banco'}</p>
                                <p className="font-mono text-sm text-gray-600">
                                    {bankInfo!.bank_clabe.slice(0, 4)}...{bankInfo!.bank_clabe.slice(-4)}
                                </p>
                                <p className="text-xs text-gray-500">{bankInfo!.bank_holder_name}</p>
                            </div>
                            <Check size={20} className="text-green-500" />
                        </div>
                    </div>
                )}
            </div>

            {/* Payout History */}
            {payouts.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Banknote size={18} className="text-gray-600" />
                        <span className="font-bold text-gray-800">收款记录 / Historial</span>
                    </div>

                    <div className="space-y-2">
                        {displayPayouts.map(payout => (
                            <div key={payout.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-200 rounded-lg overflow-hidden">
                                        {payout.products?.images?.[0] ? (
                                            <img src={payout.products.images[0]} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">N/A</div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm truncate max-w-[150px]">
                                            {payout.products?.title || 'Producto'}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(payout.completed_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-800">${payout.payoutAmount?.toLocaleString()}</p>
                                    <p className="text-xs flex items-center gap-1 justify-end">
                                        {getStatusIcon(payout.status)}
                                        {getStatusLabel(payout.status)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {payouts.length > 3 && (
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="w-full mt-3 text-emerald-600 text-sm font-medium flex items-center justify-center gap-1"
                        >
                            {showAll ? (
                                <>收起 / Ocultar <ChevronUp size={16} /></>
                            ) : (
                                <>查看全部 / Ver todo ({payouts.length}) <ChevronDown size={16} /></>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
