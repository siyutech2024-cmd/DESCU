import React, { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CheckCircle, XCircle, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { API_BASE_URL } from '../../services/apiConfig';

interface PriceNegotiationCardProps {
    content: {
        negotiationId: string;
        originalPrice: number;
        proposedPrice: number;
        counterPrice?: number;
        productTitle: string;
        status: 'pending' | 'accepted' | 'rejected' | 'countered';
        finalPrice?: number;
    };
    isSeller: boolean;
    onUpdate?: () => void;
}

export const PriceNegotiationCard: React.FC<PriceNegotiationCardProps> = ({
    content,
    isSeller,
    onUpdate
}) => {
    const { negotiationId, originalPrice, proposedPrice, counterPrice, productTitle, status, finalPrice } = content;
    const [isResponding, setIsResponding] = useState(false);
    const [counterInput, setCounterInput] = useState('');
    const [showCounterInput, setShowCounterInput] = useState(false);

    const priceChange = ((proposedPrice - originalPrice) / originalPrice * 100).toFixed(1);
    const isDiscount = proposedPrice < originalPrice;

    const handleRespond = async (action: 'accept' | 'reject' | 'counter') => {
        setIsResponding(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('[Negotiation Response] No session');
                return;
            }

            const body: any = { action };
            if (action === 'counter' && counterInput) {
                body.counterPrice = parseFloat(counterInput);
            }

            console.log('[Negotiation Response] Sending:', { negotiationId, action, body });

            const response = await fetch(`${API_BASE_URL}/api/negotiations/${negotiationId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(body)
            });

            console.log('[Negotiation Response] Status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[Negotiation Response] Error:', JSON.stringify(errorData, null, 2));
                throw new Error(errorData.message || errorData.error || 'Failed to respond');
            }

            const result = await response.json();
            console.log('[Negotiation Response] Success:', result);

            setShowCounterInput(false);
            setCounterInput('');
            onUpdate?.();
        } catch (error: any) {
            console.error('[Negotiation Response] Error:', error);
            alert(error.message || '响应议价失败，请重试');
        } finally {
            setIsResponding(false);
        }
    };

    const getStatusBadge = () => {
        const badges = {
            accepted: { bg: 'from-green-400 to-emerald-500', icon: CheckCircle, text: '已接受' },
            rejected: { bg: 'from-red-400 to-rose-500', icon: XCircle, text: '已拒绝' },
            countered: { bg: 'from-blue-400 to-indigo-500', icon: RefreshCw, text: '卖家还价' },
            pending: { bg: 'from-amber-400 to-orange-500', icon: DollarSign, text: '待响应' }
        };
        const config = badges[status];
        const Icon = config.icon;
        return (
            <div className={`flex items-center gap-1.5 bg-gradient-to-r ${config.bg} text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg`}>
                <Icon size={14} />
                <span>{config.text}</span>
            </div>
        );
    };

    return (
        <div className="relative overflow-hidden rounded-3xl shadow-xl max-w-sm">
            {/* 渐变背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 opacity-95" />

            {/* 装饰性气泡 */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                        <DollarSign className="text-white drop-shadow-lg" size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={12} className="text-yellow-300" />
                            <span className="text-xs font-bold text-white/90 uppercase tracking-wider">议价</span>
                        </div>
                        <p className="text-sm text-white/80 truncate max-w-[140px]">{productTitle}</p>
                    </div>
                </div>
                {getStatusBadge()}
            </div>

            {/* Price Comparison */}
            <div className="relative px-4 space-y-3 mb-4">
                <div className="flex justify-between items-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                    <span className="text-sm text-white/80">原价</span>
                    <span className="text-white/60 line-through font-medium">${originalPrice.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
                    <span className="text-sm font-bold text-white">出价</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-white">${proposedPrice.toFixed(2)}</span>
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isDiscount ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'}`}>
                            {isDiscount ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                            {Math.abs(parseFloat(priceChange))}%
                        </div>
                    </div>
                </div>

                {counterPrice && (
                    <div className="flex justify-between items-center bg-blue-500/30 backdrop-blur-sm rounded-xl px-4 py-3 border border-blue-300/30">
                        <span className="text-sm font-bold text-white">卖家报价</span>
                        <span className="text-2xl font-black text-white">${counterPrice.toFixed(2)}</span>
                    </div>
                )}

                {finalPrice && (
                    <div className="flex justify-between items-center bg-green-500/40 backdrop-blur-sm rounded-xl px-4 py-3 border-2 border-green-300/50">
                        <span className="text-sm font-black text-white">成交价</span>
                        <span className="text-2xl font-black text-white">${finalPrice.toFixed(2)}</span>
                    </div>
                )}
            </div>

            {/* Actions for Seller */}
            {status === 'pending' && isSeller && !showCounterInput && (
                <div className="relative px-4 pb-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => handleRespond('accept')}
                            disabled={isResponding}
                            className="bg-white text-green-600 py-3 rounded-xl font-bold text-sm hover:bg-green-50 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                        >
                            <CheckCircle size={16} />
                            接受
                        </button>
                        <button
                            onClick={() => setShowCounterInput(true)}
                            disabled={isResponding}
                            className="bg-white/20 backdrop-blur-sm text-white py-3 rounded-xl font-bold text-sm hover:bg-white/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 border border-white/30 active:scale-95"
                        >
                            <RefreshCw size={16} />
                            还价
                        </button>
                        <button
                            onClick={() => handleRespond('reject')}
                            disabled={isResponding}
                            className="bg-white/10 backdrop-blur-sm text-white/80 py-3 rounded-xl font-bold text-sm hover:bg-white/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
                        >
                            <XCircle size={16} />
                            拒绝
                        </button>
                    </div>
                </div>
            )}

            {/* Counter Price Input */}
            {showCounterInput && (
                <div className="relative px-4 pb-4 space-y-2">
                    <div className="relative">
                        <span className="absolute left-4 top-3 text-white/60 font-bold">$</span>
                        <input
                            type="number"
                            value={counterInput}
                            onChange={(e) => setCounterInput(e.target.value)}
                            placeholder="输入您的报价"
                            className="w-full pl-8 pr-4 py-3 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl focus:outline-none focus:border-white/50 text-white placeholder-white/50 font-bold"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleRespond('counter')}
                            disabled={!counterInput || isResponding}
                            className="flex-1 bg-white text-orange-600 py-3 rounded-xl font-bold hover:bg-orange-50 disabled:opacity-50 shadow-lg active:scale-95"
                        >
                            确认还价
                        </button>
                        <button
                            onClick={() => setShowCounterInput(false)}
                            className="px-6 py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 active:scale-95"
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}

            {/* Status Messages */}
            {status === 'accepted' && (
                <div className="relative mx-4 mb-4 bg-green-500/40 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-center font-bold border border-green-300/30">
                    ✅ 议价成功！价格 ${finalPrice?.toFixed(2) || proposedPrice.toFixed(2)}
                </div>
            )}

            {status === 'rejected' && (
                <div className="relative mx-4 mb-4 bg-red-500/40 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-center font-bold border border-red-300/30">
                    ❌ 卖家拒绝了此议价
                </div>
            )}

            {status === 'countered' && !isSeller && (
                <div className="relative mx-4 mb-4 bg-blue-500/40 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-center text-sm border border-blue-300/30">
                    💬 卖家提出新报价 <span className="font-bold">${counterPrice?.toFixed(2)}</span>
                </div>
            )}
        </div>
    );
};
