import React, { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { sendRichMessage } from '@/services/chatService';
import { useLanguage, useLocale } from '@/i18n';
import { notify } from '@/lib/toast';
import { Sheet } from '@/components/ui/Sheet';
import { Button, ChoiceChip, Field, inputClass } from '@/components/ui/primitives';

interface MeetupTimeSenderProps {
    open: boolean;
    conversationId: string;
    productTitle?: string;
    onSent?: () => void;
    onClose: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar date as YYYY-MM-DD (toISOString would shift the day near midnight). */
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Bottom sheet to propose a meetup date/time (+ optional place and note). */
export const MeetupTimeSender: React.FC<MeetupTimeSenderProps> = ({ open, conversationId, productTitle, onSent, onClose }) => {
    const { t } = useLanguage();
    const locale = useLocale();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState('');
    const [note, setNote] = useState('');
    const [isSending, setIsSending] = useState(false);

    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            value: localDate(d),
            label: i === 0 ? t('meetup.today') : i === 1 ? t('meetup.tomorrow') : d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }),
        };
    }), [locale, t]);

    const times = useMemo(() => {
        const out: string[] = [];
        for (let h = 9; h <= 21; h++) { out.push(`${pad(h)}:00`); if (h < 21) out.push(`${pad(h)}:30`); }
        return out;
    }, []);

    const reset = () => { setDate(''); setTime(''); setLocation(''); setNote(''); };
    const close = () => { reset(); onClose(); };

    const send = async () => {
        if (!date || !time) { notify.error(t('meetup.alert_datetime')); return; }
        setIsSending(true);
        try {
            const when = new Date(`${date}T${time}`);
            await sendRichMessage(conversationId, 'meetup_time', {
                datetime: when.toISOString(), date, time,
                location: location.trim() || t('meetup.location_tbd'),
                note: note.trim(), product_title: productTitle || '', status: 'proposed',
            }, `📅 ${t('meetup.send_invite')}: ${date} ${time}`);
            reset();
            onSent?.();
        } catch {
            notify.error(t('meetup.alert_send_failed'));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={close}
            variant="bottom"
            title={t('meetup.title')}
            closeLabel={t('modal.close')}
            footer={<Button block size="lg" onClick={send} disabled={!date || !time} loading={isSending} icon={<CalendarClock size={18} />}>{t('meetup.send_invite')}</Button>}
        >
            <div className="space-y-4 pb-2">
                {productTitle && <p className="text-sm text-gray-500 truncate">{t('meetup.product')}: <span className="font-bold text-gray-800">{productTitle}</span></p>}

                <Field label={t('meetup.select_date')}>
                    <div className="grid grid-cols-4 gap-2">
                        {days.map(d => <ChoiceChip key={d.value} selected={date === d.value} onClick={() => setDate(d.value)} className="capitalize">{d.label}</ChoiceChip>)}
                    </div>
                </Field>

                <Field label={t('meetup.select_time')}>
                    <select value={time} onChange={e => setTime(e.target.value)} className={inputClass}>
                        <option value="">{t('meetup.select_time_placeholder')}</option>
                        {times.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </Field>

                <Field label={t('meetup.location_label')}>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder={t('meetup.location_placeholder')} className={inputClass} maxLength={120} />
                </Field>

                <Field label={t('meetup.note_label')} hint={t('meetup.tip')}>
                    <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('meetup.note_placeholder')} rows={2} className={`${inputClass} resize-none`} maxLength={300} />
                </Field>
            </div>
        </Sheet>
    );
};
