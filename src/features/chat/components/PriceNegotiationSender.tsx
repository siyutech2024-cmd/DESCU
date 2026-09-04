import React, { useState, useEffect } from 'react';
import { Tag, Package } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useRegion } from '@/contexts/RegionContext';
import { api, ApiError } from '@/lib/api/client';
import { notify } from '@/lib/toast';
import { Sheet } from '@/components/ui/Sheet';
import { Button, ChoiceChip, Field, inputClass } from '@/components/ui/primitives';

interface PriceNegotiationSenderProps {
    open: boolean;
    currentPrice: number;
    productId: string;
    conversationId: string;
    onSent?: () => void;
    onClose: () => void;
}

interface ProductInfo { title: string; image?: string; price: number; currency: string }

/** Offers below this share of the asking price are refused (the seller would just decline). */
const MIN_OFFER_RATIO = 0.3;
const QUICK_DISCOUNTS = [5, 10, 15, 20];

/** Bottom sheet for the buyer to propose a price. */
export const PriceNegotiationSender: React.FC<PriceNegotiationSenderProps> = ({ open, currentPrice, productId, conversationId, onSent, onClose }) => {
    const { t } = useLanguage();
    const { formatCurrency } = useRegion();
    const [proposed, setProposed] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [product, setProduct] = useState<ProductInfo | null>(null);

    useEffect(() => {
        if (!open) return;
        api.get<{ title: string; images?: string[]; price: number; currency?: string }>(`/api/products/${productId}`, { auth: 'optional' })
            .then(d => setProduct({ title: d.title, image: d.images?.[0], price: Number(d.price) || 0, currency: d.currency || 'MXN' }))
            .catch(() => setProduct(null));
    }, [productId, open]);

    const price = product?.price || currentPrice;
    const currency = product?.currency || 'MXN';
    const value = parseFloat(proposed);
    const valid = Number.isFinite(value) && value > 0;
    const minOffer = Math.ceil(price * MIN_OFFER_RATIO);
    const tooLow = valid && price > 0 && value < minOffer;
    const notBelow = valid && price > 0 && value >= price;
    const blocked = tooLow || notBelow;
    const discount = valid && price > 0 ? Math.round((1 - value / price) * 100) : 0;

    const close = () => { setProposed(''); onClose(); };

    const propose = async () => {
        if (!valid) { notify.error(t('negotiate.invalid_price')); return; }
        if (blocked) return;
        setIsSending(true);
        try {
            await api.post('/api/negotiations/propose', { conversationId, productId, proposedPrice: value }, { auth: 'required' });
            notify.success(t('negotiate.sent'));
            setProposed('');
            onSent?.();
        } catch (error) {
            const detail = error instanceof ApiError ? ((error.body as any)?.message || (error.body as any)?.error) : undefined;
            notify.error(detail || t('negotiate.send_failed'));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={close}
            variant="bottom"
            title={t('chat.offer_title')}
            closeLabel={t('modal.close')}
            footer={<Button block size="lg" onClick={propose} disabled={!valid || blocked} loading={isSending} icon={<Tag size={18} />}>{t('chat.send_offer')}</Button>}
        >
            <div className="space-y-4 pb-2">
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    {product?.image ? (
                        <img src={product.image} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-200" />
                    ) : (
                        <span className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400"><Package size={22} /></span>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{product?.title ?? '…'}</p>
                        <p className="text-xs text-gray-500">{t('chat.current_price')} · <span className="font-bold text-gray-800 tabular-nums">{formatCurrency(price, currency)}</span></p>
                    </div>
                </div>

                <Field label={t('negotiate.your_offer')} hint={blocked ? undefined : discount > 0 ? `−${discount}% · ${t('negotiate.save_amount')} ${formatCurrency(price - value, currency)}` : undefined} error={tooLow ? t('negotiate.too_low', { min: formatCurrency(minOffer, currency) }) : notBelow ? t('negotiate.not_below') : undefined}>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">$</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            min={1}
                            step={1}
                            value={proposed}
                            onChange={e => setProposed(e.target.value)}
                            placeholder="0"
                            className={`${inputClass} pl-9 text-2xl font-black tabular-nums`}
                            data-autofocus
                        />
                    </div>
                </Field>

                <div className="flex flex-wrap gap-2">
                    {QUICK_DISCOUNTS.map(pct => {
                        const v = Math.round(price * (1 - pct / 100));
                        return (
                            <ChoiceChip key={pct} selected={valid && value === v} onClick={() => setProposed(String(v))} disabled={price <= 0}>
                                −{pct}% · {formatCurrency(v, currency)}
                            </ChoiceChip>
                        );
                    })}
                </div>

                <p className="text-xs text-gray-400">{t('negotiate.subtitle_hint')}</p>
            </div>
        </Sheet>
    );
};
