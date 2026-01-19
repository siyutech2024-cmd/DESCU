import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, X, Loader2, Package } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_BASE_URL } from '../../services/apiConfig';

interface PriceNegotiationSenderProps {
    currentPrice: number;
    productId: string;
    conversationId: string;
    onSent?: () => void;
}

interface ProductInfo {
    title: string;
    images: string[];
    price: number;
}

export const PriceNegotiationSender: React.FC<PriceNegotiationSenderProps> = ({
    currentPrice,
    productId,
    conversationId,
    onSent
}) => {
    const { t } = useLanguage();
    const [proposedPrice, setProposedPrice] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch product info
    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const { data } = await supabase
                    .from('products')
                    .select('title, images, price')
                    .eq('id', productId)
                    .single();
                if (data) {
                    setProductInfo(data);
                }
            } catch (err) {
                console.error('Error fetching product:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProduct();
    }, [productId]);

    const actualPrice = productInfo?.price || currentPrice;
    const discountPercent = proposedPrice && actualPrice > 0
        ? ((actualPrice - parseFloat(proposedPrice)) / actualPrice * 100).toFixed(0)
        : '0';

    const handlePropose = async () => {
        if (!proposedPrice || parseFloat(proposedPrice) <= 0) {
            alert('请输入有效的价格 / Por favor ingresa un precio válido');
            return;
        }

        setIsSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('请先登录 / Por favor inicia sesión');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/negotiations/propose`, {
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

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to propose');
            }

            setProposedPrice('');
            onSent?.();
        } catch (error: any) {
            console.error('Error proposing price:', error);
            alert(error.message || '发送议价失败，请重试 / Error al enviar oferta');
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200 shadow-lg">
                <div className="flex items-center justify-center py-4">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-4 border border-blue-200 shadow-lg animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <DollarSign className="text-white" size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900">{t('chat.offer_title')}</h4>
                        <p className="text-xs text-gray-500">Negociar precio</p>
                    </div>
                </div>
            </div>

            {/* Product Card */}
            {productInfo && (
                <div className="bg-white rounded-xl p-3 mb-4 flex items-center gap-3 shadow-sm border border-gray-100">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {productInfo.images?.[0] ? (
                            <img src={productInfo.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Package size={24} className="text-gray-300" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">{productInfo.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg font-bold text-orange-600">${actualPrice.toLocaleString()}</span>
                            <span className="text-xs text-gray-400 line-through">{t('chat.current_price')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Price Input */}
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('chat.your_offer')} / Tu oferta:
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">$</span>
                        <input
                            type="number"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-10 pr-4 py-4 border-2 border-blue-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-2xl font-bold text-gray-900 bg-white"
                            step="1"
                            min="0"
                        />
                    </div>

                    {/* Discount Badge */}
                    {proposedPrice && parseFloat(proposedPrice) > 0 && parseFloat(proposedPrice) < actualPrice && (
                        <div className="flex items-center gap-2 mt-2 animate-fade-in">
                            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                                <TrendingDown size={14} />
                                <span>-{discountPercent}% 优惠 / descuento</span>
                            </div>
                            <span className="text-sm text-gray-500">
                                省 ${(actualPrice - parseFloat(proposedPrice)).toLocaleString()}
                            </span>
                        </div>
                    )}

                    {/* Warning if price too low */}
                    {proposedPrice && parseFloat(discountPercent) > 50 && (
                        <p className="text-xs text-orange-600 mt-2">
                            ⚠️ 出价过低可能不被接受 / Oferta baja podría ser rechazada
                        </p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={handlePropose}
                        disabled={isSending || !proposedPrice || parseFloat(proposedPrice) <= 0}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 rounded-xl font-bold hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                        {isSending ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <DollarSign size={18} />
                        )}
                        {isSending ? '发送中...' : t('chat.send_offer')}
                    </button>
                    <button
                        onClick={() => onSent?.()}
                        className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                    >
                        {t('chat.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
