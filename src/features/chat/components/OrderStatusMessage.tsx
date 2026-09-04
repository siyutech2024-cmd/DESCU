import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Banknote, MapPin, Truck, CheckCircle, Calendar, Package, PartyPopper, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { useLanguage, useLocale } from '@/i18n';
import { useRegion } from '@/contexts/RegionContext';
import { Button, type ChipTone } from '@/components/ui/primitives';
import { MessageCard, CardFooter } from './MessageCard';

interface OrderStatusMessageProps {
    content: {
        orderId: string;
        eventType?: string;
        status?: string;
        productTitle: string;
        productImage?: string | null;
        productId?: string;
        amount?: number;
        totalAmount?: number;
        currency?: string;
        orderType?: string;
        paymentMethod?: string;
        message?: string;
        description?: string;
        location?: string;
        time?: string;
        trackingNumber?: string;
        buyerId?: string;
        [key: string]: unknown;
    };
    /** Who is looking at the card — picks the buyer or seller wording. */
    currentUserId?: string;
}

const KNOWN_EVENTS = new Set([
    'created', 'paid', 'escrow_held', 'shipped', 'meetup_arranged',
    'buyer_confirmed', 'seller_confirmed', 'completed', 'cancelled', 'disputed',
]);

const EVENT_STYLE: Record<string, { icon: React.ReactNode; tone: ChipTone }> = {
    created: { icon: <ShoppingBag size={16} />, tone: 'brand' },
    paid: { icon: <Banknote size={16} />, tone: 'success' },
    escrow_held: { icon: <Banknote size={16} />, tone: 'success' },
    meetup_arranged: { icon: <MapPin size={16} />, tone: 'info' },
    shipped: { icon: <Truck size={16} />, tone: 'info' },
    delivered: { icon: <Package size={16} />, tone: 'info' },
    buyer_confirmed: { icon: <CheckCircle size={16} />, tone: 'success' },
    seller_confirmed: { icon: <CheckCircle size={16} />, tone: 'success' },
    confirmed: { icon: <CheckCircle size={16} />, tone: 'success' },
    completed: { icon: <PartyPopper size={16} />, tone: 'success' },
    cancelled: { icon: <XCircle size={16} />, tone: 'neutral' },
    disputed: { icon: <AlertTriangle size={16} />, tone: 'danger' },
};

/** Order timeline event rendered in the chat (created / paid / shipped / …). */
export const OrderStatusMessage: React.FC<OrderStatusMessageProps> = ({ content, currentUserId }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const locale = useLocale();
    const { formatCurrency } = useRegion();
    const { orderId, productTitle, productImage, message, description, location, time, trackingNumber, productId, buyerId, currency } = content;
    // Older cards carried `status` only; both mean the same thing.
    const eventType = content.eventType || content.status || 'default';
    const eventKey = KNOWN_EVENTS.has(eventType) ? eventType : 'default';
    const amount = Number(content.amount ?? content.totalAmount ?? 0);

    // Cards written by the server carry no copy: localize by event and by the viewer's role.
    // Cards written by older clients carry `message`/`description` in the sender's language.
    const role = buyerId && currentUserId && buyerId !== currentUserId ? 'seller' : 'buyer';
    const title = message || t(`order_msg.${eventKey}.title`);
    const body = description || t(`order_msg.${eventKey}.${role}`);
    const style = EVENT_STYLE[eventType] ?? { icon: <Package size={16} />, tone: 'neutral' as ChipTone };

    return (
        <MessageCard icon={style.icon} tone={style.tone} label={t('chat.order_status_label')} title={title}>
            <p className="px-4 pb-3 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{body}</p>

            <button
                type="button"
                onClick={() => productId && navigate(`/product/${productId}`)}
                disabled={!productId}
                className="mx-4 mb-3 w-[calc(100%-2rem)] flex items-center gap-3 rounded-xl bg-gray-50 p-2.5 text-left transition-colors enabled:hover:bg-gray-100 disabled:cursor-default"
            >
                {productImage ? (
                    <img src={productImage} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-gray-200" />
                ) : (
                    <span className="w-11 h-11 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0"><Package size={18} /></span>
                )}
                <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-900 truncate">{productTitle}</span>
                    {amount > 0 && <span className="block text-xs text-gray-500 tabular-nums">{formatCurrency(amount, currency || 'MXN')}</span>}
                </span>
                {productId && <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
            </button>

            {(location || time || trackingNumber) && (
                <dl className="px-4 pb-3 space-y-1.5 text-sm">
                    {location && <div className="flex items-start gap-2"><MapPin size={15} className="text-gray-400 mt-0.5 flex-shrink-0" /><dd className="text-gray-700">{location}</dd></div>}
                    {time && <div className="flex items-start gap-2"><Calendar size={15} className="text-gray-400 mt-0.5 flex-shrink-0" /><dd className="text-gray-700">{new Date(time).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>}
                    {trackingNumber && <div className="flex items-start gap-2"><Truck size={15} className="text-gray-400 mt-0.5 flex-shrink-0" /><dd className="text-gray-700 font-mono text-xs">{trackingNumber}</dd></div>}
                </dl>
            )}

            <CardFooter className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 font-mono">{t('order_msg.order_number', { id: orderId?.slice(0, 8) || '…' })}</span>
                <Button size="sm" variant="ghost" onClick={() => navigate('/orders')} className="-mr-2 text-brand-700">{t('orders.title')}</Button>
            </CardFooter>
        </MessageCard>
    );
};
