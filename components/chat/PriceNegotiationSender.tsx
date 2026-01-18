import React, { useState } from 'react';
import { DollarSign, TrendingDown } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface PriceNegotiationSenderProps {
    currentPrice: number;
    productId: string;
    conversationId: string;
    onSent?: () => void;
}

export const PriceNegotiationSender: React.FC<PriceNegotiationSenderProps> = ({
    currentPrice,
    productId,
    conversationId,
    onSent
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [proposedPrice, setProposedPrice] = useState('');
    const [isSending, setIsSending] = useState(false);

    const discountPercent = proposedPrice
        ? ((currentPrice - parseFloat(proposedPrice)) / currentPrice * 100).toFixed(1)
        : '0';

    const handlePropose = async () => {
        if (!proposedPrice || parseFloat(proposedPrice) <= 0) {
            alert('请输入有效的价格');
            return;
        }

        setIsSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('请先登录');
                return;
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/negotiations/propose`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    conversationId,
                    productId,
                    proposedPrice: parseFloat(proposedPrice)
                })
            });

            if (!response.ok) throw new Error('Failed to propose');

            setIsOpen(false);
            setProposedPrice('');
            onSent?.();
        } catch (error) {
            console.error('Error proposing price:', error);
            alert('发送议价失败，请重试');
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
            >
                <DollarSign size={18} />
                <span>议价</span>
            </button>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200 shadow-md">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <DollarSign className="text-white" size={16} />
                </div>
                <h4 className="font-bold text-gray-900">提出议价</h4>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">当前价格:</span>
                    <span className="font-bold text-gray-900">${currentPrice.toFixed(2)}</span>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        您的出价:
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                            type="number"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(e.target.value)}
                            placeholder="输入价格"
                            className="w-full pl-8 pr-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500"
                            step="0.01"
                            min="0"
                        />
                    </div>
                    {proposedPrice && parseFloat(proposedPrice) < currentPrice && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-green-600">
                            <TrendingDown size={14} />
                            <span>优惠 {discountPercent}%</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handlePropose}
                        disabled={isSending || !proposedPrice}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
                    >
                        {isSending ? '发送中...' : '发送议价'}
                    </button>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setProposedPrice('');
                        }}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};
