import React, { useState } from 'react';
import { Tag, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useLanguage } from '@/i18n';
import { useRegion } from '@/contexts/RegionContext';
import { notify } from '@/lib/toast';
import { Button, inputClass, type ChipTone } from '@/components/ui/primitives';
import { MessageCard, CardRow, CardFooter } from './MessageCard';

interface PriceNegotiationCardProps {
    content: {
        negotiationId: string;
        originalPrice: number;
        proposedPrice: number;
        counterPrice?: number;
        productTitle: string;
        status: 'pending' | 'accepted' | 'rejected' | 'countered';
        finalPrice?: number;
        currency?: string;
    };
    isSeller: boolean;
    onUpdate?: () => void;
}

const STATUS_TONE: Record<PriceNegotiationCardProps['content']['status'], ChipTone> = {
    pending: 'warning', accepted: 'success', rejected: 'neutral', countered: 'info',
};

export const PriceNegotiationCard: React.FC<PriceNegotiationCardProps> = ({ content, isSeller, onUpdate }) => {
    const { negotiationId, originalPrice = 0, proposedPrice = 0, counterPrice, productTitle, status, finalPrice, currency = 'MXN' } = content;
    const { t } = useLanguage();
    const { formatCurrency } = useRegion();
    const [isResponding, setIsResponding] = useState(false);
    const [counterInput, setCounterInput] = useState('');
    const [showCounterInput, setShowCounterInput] = useState(false);

    const money = (v: number) => formatCurrency(v, currency);
    const discount = originalPrice > 0 ? Math.round((1 - proposedPrice / originalPrice) * 100) : 0;

    const handleRespond = async (action: 'accept' | 'reject' | 'counter') => {
        setIsResponding(true);
        try {
            const body: { action: string; counterPrice?: number } = { action };
            if (action === 'counter') {
                const value = parseFloat(counterInput);
                if (!Number.isFinite(value) || value <= 0) { notify.error(t('negotiate.invalid_price')); return; }
                body.counterPrice = value;
            }
            await api.post(`/api/negotiations/${negotiationId}/respond`, body, { auth: 'required' });
            setShowCounterInput(false);
            setCounterInput('');
            onUpdate?.();
        } catch (error) {
            const detail = error instanceof ApiError ? ((error.body as any)?.message || (error.body as any)?.error) : undefined;
            notify.error(detail || t('nego.failed'));
        } finally {
            setIsResponding(false);
        }
    };

    const StatusIcon = { pending: Clock, accepted: CheckCircle, rejected: XCircle, countered: RefreshCw }[status];
    const statusText = t(`nego.status.${status}`);

    return (
        <MessageCard
            icon={<Tag size={16} />}
            label={t('nego.title')}
            title={productTitle}
            status={{ text: statusText, tone: STATUS_TONE[status], icon: <StatusIcon size={12} /> }}
        >
            <div className="pb-2">
                <CardRow label={t('nego.original_price')} value={money(originalPrice)} muted />
                <CardRow
                    label={isSeller ? t('nego.buyer_offer') : t('nego.your_offer')}
                    value={<>{money(proposedPrice)}{discount > 0 && <span className="ml-2 text-xs font-bold text-green-600 align-middle">−{discount}%</span>}</>}
                    strong={status === 'pending' && !counterPrice}
                />
                {counterPrice !== undefined && counterPrice !== null && (
                    <CardRow label={t('nego.counter_price')} value={money(counterPrice)} strong={status === 'countered'} />
                )}
                {finalPrice !== undefined && finalPrice !== null && status === 'accepted' && (
                    <CardRow label={t('nego.final_price')} value={money(finalPrice)} strong />
                )}
            </div>

            {status === 'pending' && isSeller && !showCounterInput && (
                <CardFooter className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => handleRespond('accept')} loading={isResponding} icon={<CheckCircle size={16} />} className="col-span-2">{t('nego.action.accept')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowCounterInput(true)} disabled={isResponding} icon={<RefreshCw size={16} />}>{t('nego.action.counter')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRespond('reject')} disabled={isResponding} icon={<XCircle size={16} />}>{t('nego.action.reject')}</Button>
                </CardFooter>
            )}

            {showCounterInput && (
                <CardFooter className="space-y-2">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            min={1}
                            value={counterInput}
                            onChange={e => setCounterInput(e.target.value)}
                            placeholder={t('nego.enter_price')}
                            className={`${inputClass} pl-8 font-bold`}
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" onClick={() => handleRespond('counter')} loading={isResponding} disabled={!counterInput}>{t('nego.confirm_counter')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowCounterInput(false); setCounterInput(''); }}>{t('nego.cancel')}</Button>
                    </div>
                </CardFooter>
            )}

            {status === 'pending' && !isSeller && (
                <CardFooter><p className="text-xs text-gray-500">{t('meetup.waiting')}</p></CardFooter>
            )}
            {status === 'accepted' && (
                <CardFooter className="bg-green-50/60">
                    <p className="text-sm font-bold text-green-700">{t('nego.success.accepted')} {money(finalPrice ?? proposedPrice)}</p>
                    <p className="text-xs text-green-700/80 mt-0.5">{isSeller ? t('nego.applies_seller') : t('nego.applies_buyer')}</p>
                </CardFooter>
            )}
            {status === 'rejected' && (
                <CardFooter><p className="text-sm text-gray-500">{t('nego.success.rejected')}</p></CardFooter>
            )}
            {status === 'countered' && !isSeller && counterPrice !== undefined && (
                <CardFooter className="bg-blue-50/60"><p className="text-sm text-blue-800">{t('nego.success.countered')} <span className="font-bold">{money(counterPrice)}</span></p></CardFooter>
            )}
        </MessageCard>
    );
};
