import React, { useState } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, X, Edit2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

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
}

export const MeetupTimeMessage: React.FC<MeetupTimeMessageProps> = ({
    content,
    conversationId,
    currentUserId,
    onUpdate
}) => {
    const { t, language } = useLanguage();
    const {
        datetime,
        date,
        time,
        location,
        note,
        proposed_by,
        product_title,
        status
    } = content;

    const [isResponding, setIsResponding] = useState(false);
    const isProposer = proposed_by === currentUserId;
    const canRespond = !isProposer && status === 'proposed';

    const locale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
    const meetupDate = new Date(datetime);
    const dateFormatted = meetupDate.toLocaleDateString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    const handleConfirm = async () => {
        setIsResponding(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const confirmContent = JSON.stringify({
                ...content,
                status: 'confirmed',
                confirmed_by: session.user.id,
                confirmed_at: new Date().toISOString()
            });

            await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: session.user.id,
                message_type: 'meetup_time',
                content: confirmContent,
                text: `✅ ${t('meetup.confirmed')}: ${date} ${time}`
            });

            onUpdate?.();
        } catch (error) {
            console.error('Error confirming meetup:', error);
            alert(t('meetup.alert_confirm_failed'));
        } finally {
            setIsResponding(false);
        }
    };

    const statusConfig = {
        proposed: {
            bg: 'from-amber-50 to-orange-50',
            border: 'border-amber-200',
            badge: t('meetup.status_pending'),
            badgeColor: 'bg-amber-100 text-amber-700'
        },
        confirmed: {
            bg: 'from-green-50 to-emerald-50',
            border: 'border-green-200',
            badge: t('meetup.status_confirmed'),
            badgeColor: 'bg-green-100 text-green-700'
        },
        rejected: {
            bg: 'from-red-50 to-pink-50',
            border: 'border-red-200',
            badge: t('meetup.status_rejected'),
            badgeColor: 'bg-red-100 text-red-700'
        },
        counter_proposed: {
            bg: 'from-blue-50 to-indigo-50',
            border: 'border-blue-200',
            badge: t('meetup.status_counter'),
            badgeColor: 'bg-blue-100 text-blue-700'
        }
    };

    const config = statusConfig[status];

    return (
        <div className={`bg-gradient-to-br ${config.bg} rounded-2xl p-5 border-2 ${config.border} shadow-lg max-w-sm`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Calendar className="text-white" size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">{t('meetup.title')}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.badgeColor}`}>
                            {config.badge}
                        </span>
                    </div>
                </div>
            </div>

            {/* Product Title */}
            {product_title && (
                <div className="mb-3 pb-3 border-b border-gray-200/50">
                    <p className="text-xs text-gray-500">{t('meetup.about_product')}</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{product_title}</p>
                </div>
            )}

            {/* DateTime */}
            <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                    <Calendar size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm text-gray-600">{t('meetup.date_label')}</p>
                        <p className="font-bold text-gray-900">{dateFormatted}</p>
                    </div>
                </div>

                <div className="flex items-start gap-2">
                    <Clock size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm text-gray-600">{t('meetup.time_label')}</p>
                        <p className="font-bold text-gray-900">{time}</p>
                    </div>
                </div>

                {location && location !== t('meetup.location_tbd') && (
                    <div className="flex items-start gap-2">
                        <MapPin size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm text-gray-600">{t('meetup.location_detail')}</p>
                            <p className="font-medium text-gray-900">{location}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Note */}
            {note && (
                <div className="mb-4 p-3 bg-white/60 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{t('meetup.note_detail')}</p>
                    <p className="text-sm text-gray-700">{note}</p>
                </div>
            )}

            {/* Action Buttons */}
            {canRespond && (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200/50">
                    <button
                        onClick={handleConfirm}
                        disabled={isResponding}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-md disabled:opacity-50"
                    >
                        <CheckCircle size={16} />
                        <span className="text-sm">{t('meetup.confirm_btn')}</span>
                    </button>

                    <button
                        className="flex items-center justify-center gap-2 bg-white text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-all border-2 border-gray-200"
                    >
                        <Edit2 size={16} />
                        <span className="text-sm">{t('meetup.suggest_new')}</span>
                    </button>
                </div>
            )}

            {/* Info for proposer */}
            {isProposer && status === 'proposed' && (
                <div className="mt-3 text-center text-xs text-gray-500">
                    {t('meetup.waiting')}
                </div>
            )}

            {/* Confirmed info */}
            {status === 'confirmed' && (
                <div className="mt-3 p-3 bg-green-100/50 rounded-lg text-center">
                    <p className="text-sm text-green-700 font-medium">
                        ✅ {t('meetup.confirmed')}
                    </p>
                </div>
            )}
        </div>
    );
};
