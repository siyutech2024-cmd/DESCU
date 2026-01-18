import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, ExternalLink, Check, AlertCircle, ChevronRight, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';
import { supabase } from '../services/supabase';

interface StripeExpressCardProps {
    userId: string;
}

interface AccountStatus {
    hasAccount: boolean;
    accountId?: string;
    onboardingComplete: boolean;
    payoutsEnabled: boolean;
    chargesEnabled?: boolean;
    requirements?: string[];
    email?: string;
}

export const StripeExpressCard: React.FC<StripeExpressCardProps> = ({ userId }) => {
    const [status, setStatus] = useState<AccountStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch account status on mount
    useEffect(() => {
        fetchAccountStatus();

        // Check for URL params (returning from Stripe)
        const params = new URLSearchParams(window.location.search);
        if (params.get('stripe_success')) {
            // Remove param and refresh status
            window.history.replaceState({}, '', window.location.pathname);
            setTimeout(() => fetchAccountStatus(), 1000);
        }
    }, []);

    const fetchAccountStatus = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`${API_BASE_URL}/api/stripe/express-status`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (err) {
            console.error('Error fetching status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStartOnboarding = async () => {
        setActionLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setError('Please login first');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/stripe/create-express-account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.onboardingUrl) {
                // Redirect to Stripe onboarding
                window.location.href = data.onboardingUrl;
            } else if (data.onboardingComplete) {
                // Already complete, refresh status
                fetchAccountStatus();
            } else {
                setError(data.error || 'Failed to create account');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleViewDashboard = async () => {
        setActionLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`${API_BASE_URL}/api/stripe/dashboard-link`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            const data = await response.json();
            if (data.dashboardUrl) {
                window.open(data.dashboardUrl, '_blank');
            }
        } catch (err) {
            console.error('Error getting dashboard link:', err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-600 p-6 mb-4 shadow-lg">
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={32} className="text-white animate-spin" />
                </div>
            </div>
        );
    }

    // Account is set up and payouts enabled
    if (status?.payoutsEnabled) {
        return (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 mb-4 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            <Check size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">收款已启用 / Pagos Activos</h2>
                            <p className="text-emerald-100 text-sm">Tu cuenta está lista para recibir pagos</p>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100 text-sm">Estado de cuenta</p>
                                <p className="text-white font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    Activa / 已激活
                                </p>
                            </div>
                            <ShieldCheck size={24} className="text-emerald-200" />
                        </div>
                    </div>

                    <button
                        onClick={handleViewDashboard}
                        disabled={actionLoading}
                        className="w-full bg-white text-emerald-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition-all shadow-lg"
                    >
                        {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <ExternalLink size={20} />}
                        Ver Dashboard de Stripe / 查看 Stripe 面板
                    </button>
                </div>
            </div>
        );
    }

    // Account exists but onboarding not complete
    if (status?.hasAccount && !status.onboardingComplete) {
        return (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-6 mb-4 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            <AlertCircle size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Completar registro / 完成注册</h2>
                            <p className="text-amber-100 text-sm">Falta información requerida</p>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/30 text-white rounded-xl p-3 mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleStartOnboarding}
                        disabled={actionLoading}
                        className="w-full bg-white text-orange-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-all shadow-lg"
                    >
                        {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                        Continuar con Stripe / 继续注册
                    </button>
                </div>
            </div>
        );
    }

    // No account - show start button
    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-600 p-6 mb-4 shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                        <CreditCard size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">开始收款 / Recibe Pagos</h2>
                        <p className="text-purple-100 text-sm">Configura tu cuenta bancaria</p>
                    </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
                    <ul className="text-white/90 text-sm space-y-2">
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-purple-200" />
                            Recibe pagos directamente / 直接接收付款
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-purple-200" />
                            Retiros a tu banco / 提现到银行
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-purple-200" />
                            Seguro y verificado / 安全可靠
                        </li>
                    </ul>
                </div>

                {error && (
                    <div className="bg-red-500/30 text-white rounded-xl p-3 mb-4 text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleStartOnboarding}
                    disabled={actionLoading}
                    className="w-full bg-white text-purple-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    {actionLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <ExternalLink size={20} />
                    )}
                    <span>Comenzar ahora / 立即开始</span>
                </button>

                <p className="text-center text-purple-100/80 text-xs mt-4 flex items-center justify-center gap-1">
                    <ShieldCheck size={12} />
                    Powered by Stripe - 安全支付
                </p>
            </div>
        </div>
    );
};
