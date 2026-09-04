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
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryClient';
import { useLanguage, useLocale } from '@/i18n';

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

interface PayoutData {
    payouts: PayoutItem[];
    summary: PayoutSummary;
}

const EMPTY_PAYOUTS: PayoutData = { payouts: [], summary: { totalEarned: 0, pending: 0, completed: 0 } };

const fetchPayouts = async (): Promise<PayoutData> => {
    try {
        const data = await api.get<{ payouts?: PayoutItem[]; summary?: PayoutSummary }>('/api/users/payouts', { auth: 'required' });
        return { payouts: data?.payouts || [], summary: data?.summary || EMPTY_PAYOUTS.summary };
    } catch (err) {
        // Old code ignored non-2xx responses (and skipped the call without a session); keep that quiet
        if (err instanceof ApiError) return EMPTY_PAYOUTS;
        throw err;
    }
};

export const SellerPayoutCard: React.FC<SellerPayoutCardProps> = ({ userId }) => {
    const { t } = useLanguage();
    const locale = useLocale();
    const { data: payoutData = EMPTY_PAYOUTS, isLoading: payoutsLoading } = useQuery({
        queryKey: queryKeys.payouts(userId),
        queryFn: fetchPayouts,
        enabled: !!userId,
    });
    const { payouts, summary } = payoutData;
    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
    const [bankLoading, setBankLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const [editingBank, setEditingBank] = useState(false);
    const [bankForm, setBankForm] = useState({ clabe: '', bankName: '', holderName: '' });
    const [saving, setSaving] = useState(false);
    const loading = payoutsLoading || bankLoading;

    useEffect(() => {
        let cancelled = false;
        // Fetch bank info (may fail if sellers table doesn't exist yet)
        const fetchBankInfo = async () => {
            try {
                const { bankInfo: seller } = await api.get<{ bankInfo: { bank_clabe: string; bank_name: string | null; bank_holder_name: string | null } | null }>('/api/users/bank-info', { auth: 'required' });

                if (!cancelled && seller?.bank_clabe) {
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
            } catch {
                // no bank info yet / endpoint unavailable — the form starts empty
            } finally {
                if (!cancelled) setBankLoading(false);
            }
        };
        fetchBankInfo();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const handleSaveBank = async () => {
        if (!bankForm.clabe || bankForm.clabe.length !== 18) {
            alert(t('payout.clabe_error'));
            return;
        }
        if (!bankForm.bankName.trim() || !bankForm.holderName.trim()) {
            alert(t('payout.bank_fields_required'));
            return;
        }

        setSaving(true);
        try {
            await api.post('/api/users/bank-info', {
                clabe: bankForm.clabe,
                bankName: bankForm.bankName,
                holderName: bankForm.holderName,
            }, { auth: 'required' });

            setBankInfo({
                bank_clabe: bankForm.clabe,
                bank_name: bankForm.bankName,
                bank_holder_name: bankForm.holderName
            });
            setEditingBank(false);
        } catch (err) {
            console.error('Save bank info error:', err);
            const detail = err instanceof ApiError && Array.isArray((err.body as any)?.details) ? (err.body as any).details[0]?.message : null;
            alert(detail || t('payout.save_error'));
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
            case 'completed': return t('payout.status_received');
            case 'processing': return t('payout.status_processing');
            default: return t('payout.status_pending');
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl bg-white border border-gray-100 p-6 mb-4 shadow-sm">
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={28} className="text-brand-500 animate-spin" />
                </div>
            </div>
        );
    }

    const displayPayouts = showAll ? payouts : payouts.slice(0, 3);
    const showBankForm = editingBank || !bankInfo;

    return (
        <div className="space-y-4 mb-4">
            {/* Summary Card */}
            <div className="rounded-2xl bg-brand-600 p-5 shadow-md shadow-brand-500/25 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center"><Wallet size={22} /></div>
                    <div>
                        <h2 className="text-lg font-bold leading-tight">{t('payout.title')}</h2>
                        <p className="text-brand-100 text-xs">{t('payout.subtitle')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/10 rounded-xl p-3">
                        <p className="text-brand-100 text-[11px] font-bold uppercase tracking-wide">{t('payout.total')}</p>
                        <p className="font-black text-lg tabular-nums">${summary.totalEarned.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3">
                        <p className="text-brand-100 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1"><Clock size={10} />{t('payout.pending')}</p>
                        <p className="font-black text-lg tabular-nums">${summary.pending.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3">
                        <p className="text-brand-100 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1"><Check size={10} />{t('payout.received')}</p>
                        <p className="font-black text-lg tabular-nums">${summary.completed.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Bank Info Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Building2 size={18} className="text-gray-600" />
                        <span className="font-bold text-gray-800">{t('payout.bank_account')}</span>
                    </div>
                    {bankInfo && !editingBank && (
                        <button
                            onClick={() => setEditingBank(true)}
                            className="text-brand-600 text-sm font-bold flex items-center gap-1"
                        >
                            <Edit3 size={14} />
                            {t('payout.edit')}
                        </button>
                    )}
                </div>

                {showBankForm ? (
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-gray-500">{t('payout.clabe_label')}</label>
                                <span className={`text-xs font-mono ${bankForm.clabe.length === 18 ? 'text-green-500' : 'text-gray-400'}`}>
                                    {bankForm.clabe.length}/18
                                </span>
                            </div>
                            <input
                                type="text"
                                value={bankForm.clabe}
                                onChange={e => setBankForm({ ...bankForm, clabe: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                                placeholder={t('payout.clabe_placeholder')}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-brand-100 focus:border-brand-400 outline-none font-mono text-lg tracking-wider"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">{t('payout.bank_name')}</label>
                                <input
                                    type="text"
                                    value={bankForm.bankName}
                                    onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                                    placeholder="BBVA, Santander..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-4 focus:ring-brand-100 focus:border-brand-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">{t('payout.holder_name')}</label>
                                <input
                                    type="text"
                                    value={bankForm.holderName}
                                    onChange={e => setBankForm({ ...bankForm, holderName: e.target.value })}
                                    placeholder="Nombre completo"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-4 focus:ring-brand-100 focus:border-brand-400 outline-none"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSaveBank}
                            disabled={saving || bankForm.clabe.length !== 18}
                            className={`w-full font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${bankForm.clabe.length === 18
                                ? 'bg-brand-600 text-white hover:bg-brand-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {saving && <Loader2 size={16} className="animate-spin" />}
                            {bankForm.clabe.length === 18 ? t('payout.save') : t('payout.digits_remaining').replace('{0}', String(18 - bankForm.clabe.length))}
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
                                {t('payout.cancel')}
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
                        <span className="font-bold text-gray-800">{t('payout.history')}</span>
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
                                            {new Date(payout.completed_at).toLocaleDateString(locale)}
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
                            className="w-full mt-3 text-brand-600 text-sm font-bold flex items-center justify-center gap-1"
                        >
                            {showAll ? (
                                <>{t('payout.collapse')} <ChevronUp size={16} /></>
                            ) : (
                                <>{t('payout.view_all')} ({payouts.length}) <ChevronDown size={16} /></>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
