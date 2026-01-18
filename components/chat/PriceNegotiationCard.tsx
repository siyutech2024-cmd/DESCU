import React, { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/supabase';

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
            if (!session) return;

            const body: any = { action };
            if (action === 'counter' && counterInput) {
                body.counterPrice = parseFloat(counterInput);
            }

            const response = await fetch(`${API_BASE_URL}/api/negotiations/${negotiationId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Failed to respond');

            setShowCounterInput(false);
            setCounterInput('');
            onUpdate?.();
        } catch (error) {
            console.error('Error responding to negotiation:', error);
            alert('响应议价失败，请重试');
        } finally {
            setIsResponding(false);
        }
    };

    const getStatusBadge = () => {
        switch (status) {
            case 'accepted':
                return (
                    <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium">
                        <CheckCircle size={16} />
                        <span>已接受</span>
                    </div>
                );
            case 'rejected':
                return (
                    <div className="flex items-center gap-2 bg-red-100 text-red-800 px-3 py-1.5 rounded-full text-sm font-medium">
                        <XCircle size={16} />
                        <span>已拒绝</span>
                    </div>
                );
            case 'countered':
                return (
                    <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium">
                        <RefreshCw size={16} />
                        <span>卖家还价</span>
                    </div>
                );
            case 'pending':
                return (
                    <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full text-sm font-medium">
                        <DollarSign size={16} />
                        <span>待响应</span>
                    </div>
                );
        }
    };

    return (
        <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 rounded-2xl p-5 border-2 border-yellow-200 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                        <DollarSign className="text-white" size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900">议价请求</h4>
                        <p className="text-xs text-gray-600 truncate max-w-[200px]">{productTitle}</p>
                    </div>
                </div>
                {getStatusBadge()}
            </div>

            {/* Price Comparison */}
            <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">原价:</span>
                    <span className="text-gray-500 line-through font-medium">${originalPrice.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">买家出价:</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-green-600">${proposedPrice.toFixed(2)}</span>
                        <div className={`flex items-center gap-1 text-sm ${isDiscount ? 'text-green-600' : 'text-red-600'}`}>
                            {isDiscount ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                            <span>{Math.abs(parseFloat(priceChange))}%</span>
                        </div>
                    </div>
                </div>

                {counterPrice && (
                    <div className="flex justify-between items-center pt-2 border-t border-yellow-200">
                        <span className="text-sm font-medium text-gray-900">卖家报价:</span>
                        <span className="text-2xl font-bold text-blue-600">${counterPrice.toFixed(2)}</span>
                    </div>
                )}

                {finalPrice && (
                    <div className="flex justify-between items-center pt-2 border-t-2 border-green-300">
                        <span className="text-sm font-bold text-green-900">成交价:</span>
                        <span className="text-2xl font-bold text-green-700">${finalPrice.toFixed(2)}</span>
                    </div>
                )}
            </div>

            {/* Actions for Seller */}
            {status === 'pending' && isSeller && !showCounterInput && (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleRespond('accept')}
                        disabled={isResponding}
                        className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-2.5 rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={18} />
                        <span>接受</span>
                    </button>
                    <button
                        onClick={() => setShowCounterInput(true)}
                        disabled={isResponding}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} />
                        <span>还价</span>
                    </button>
                    <button
                        onClick={() => handleRespond('reject')}
                        disabled={isResponding}
                        className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white py-2.5 rounded-lg font-medium hover:from-gray-600 hover:to-gray-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <XCircle size={18} />
                        <span>拒绝</span>
                    </button>
                </div>
            )}

            {/* Counter Price Input */}
            {showCounterInput && (
                <div className="space-y-2">
                    <input
                        type="number"
                        value={counterInput}
                        onChange={(e) => setCounterInput(e.target.value)}
                        placeholder="输入您的报价"
                        className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleRespond('counter')}
                            disabled={!counterInput || isResponding}
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            确认还价
                        </button>
                        <button
                            onClick={() => setShowCounterInput(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}

            {/* Status Messages */}
            {status === 'accepted' && (
                <div className="bg-green-100 text-green-800 px-4 py-3 rounded-lg text-center font-medium">
                    ✅ 议价成功！产品价格已更新为 ${finalPrice?.toFixed(2) || proposedPrice.toFixed(2)}
                </div>
            )}

            {status === 'rejected' && (
                <div className="bg-red-100 text-red-800 px-4 py-3 rounded-lg text-center font-medium">
                    ❌ 卖家拒绝了此议价
                </div>
            )}

            {status === 'countered' && !isSeller && (
                <div className="bg-blue-100 text-blue-800 px-4 py-3 rounded-lg text-center text-sm">
                    💬 卖家提出新报价 ${counterPrice?.toFixed(2)}
                    <br />
                    <span className="text-xs">您可以继续协商或接受此价格</span>
                </div>
            )}
        </div>
    );
};
