import React, { useState } from 'react';
import { CalendarClock, Clock, MapPin, CheckCircle, Edit2 } from 'lucide-react';
import { sendRichMessage } from '@/services/chatService';
import { useLanguage, useLocale } from '@/i18n';
import { notify } from '@/lib/toast';
import { Button, type ChipTone } from '@/components/ui/primitives';
import { MessageCard, CardFooter } from './MessageCard';

interface MeetupTimeMessageProps {
    content: {
        datetime: string;
        date: string;
        time: string;
        location: string;
        note?: string;
        proposed_by: string;
        product_title?: string;
        status: 'proposed' | 'confirmed' | 'rejected' | 'counter_proposed';
        confirmed_by?: string;
        timestamp: string;
    };
    conversationId: string;
    currentUserId: string;
    onUpdate?: () => void;
    /** Opens the meetup composer so the other party can suggest another time. */
    onSuggestNew?: () => void;
}

const STATUS: Record<MeetupTimeMessageProps['content']['status'], { key: string; tone: ChipTone }> = {
    proposed: { key: 'meetup.status_pending', tone: 'warning' },
    confirmed: { key: 'meetup.status_confirmed', tone: 'success' },
    rejected: { key: 'meetup.status_rejected', tone: 'neutral' },
    counter_proposed: { key: 'meetup.status_counter', tone: 'info' },
};

/** Strip the emoji some legacy translations carry in front of the status word. */
const plain = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '').trim();

export const MeetupTimeMessage: React.FC<MeetupTimeMessageProps> = ({ content, conversationId, currentUserId, onUpdate, onSuggestNew }) => {
    const { t } = useLanguage();
    const locale = useLocale();
    const { datetime, date, time, location, note, proposed_by, product_title, status } = content;
    const [isResponding, setIsResponding] = useState(false);
    const isProposer = proposed_by === currentUserId;
    const canRespond = !isProposer && status === 'proposed';

    const when = new Date(datetime);
    const dateFormatted = Number.isNaN(when.getTime()) ? date : when.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    const hasLocation = !!location && location !== t('meetup.location_tbd');

    const handleConfirm = async () => {
        setIsResponding(true);
        try {
            await sendRichMessage(conversationId, 'meetup_time', { ...content, status: 'confirmed', confirmed_by: currentUserId }, `✅ ${t('meetup.confirmed')}: ${date} ${time}`);
            onUpdate?.();
        } catch {
            notify.error(t('meetup.alert_confirm_failed'));
        } finally {
            setIsResponding(false);
        }
    };

    const st = STATUS[status] ?? STATUS.proposed;

    return (
        <MessageCard icon={<CalendarClock size={16} />} label={t('meetup.title')} title={product_title} status={{ text: plain(t(st.key)), tone: st.tone }}>
            <div className="px-4 pb-3">
                <p className="text-xl font-black text-gray-900 first-letter:uppercase leading-tight">{dateFormatted}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-700 tabular-nums"><Clock size={14} className="text-brand-600" />{time}</p>
                {hasLocation && <p className="mt-1.5 flex items-start gap-1.5 text-sm text-gray-600"><MapPin size={14} className="text-brand-600 mt-0.5 flex-shrink-0" /><span>{location}</span></p>}
                {note && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{note}</p>}
            </div>

            {canRespond && (
                <CardFooter className="space-y-2">
                    <Button size="sm" block onClick={handleConfirm} loading={isResponding} icon={<CheckCircle size={16} />}>{t('meetup.confirm_btn')}</Button>
                    <Button size="sm" block variant="ghost" onClick={onSuggestNew} disabled={!onSuggestNew} icon={<Edit2 size={16} />}>{t('meetup.suggest_new')}</Button>
                </CardFooter>
            )}
            {isProposer && status === 'proposed' && <CardFooter><p className="text-xs text-gray-500">{t('meetup.waiting')}</p></CardFooter>}
            {status === 'confirmed' && <CardFooter className="bg-green-50/60"><p className="text-sm font-bold text-green-700">{t('meetup.confirmed')}</p></CardFooter>}
        </MessageCard>
    );
};
