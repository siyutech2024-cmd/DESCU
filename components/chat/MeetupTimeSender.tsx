import React, { useState } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, X } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface MeetupTimeSenderProps {
    conversationId: string;
    productTitle?: string;
    onSent?: () => void;
    onClose?: () => void;
}

export const MeetupTimeSender: React.FC<MeetupTimeSenderProps> = ({
    conversationId,
    productTitle,
    onSent,
    onClose
}) => {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [location, setLocation] = useState('');
    const [note, setNote] = useState('');
    const [isSending, setIsSending] = useState(false);

    // 获取未来7天的日期
    const getAvailableDates = () => {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push({
                value: date.toISOString().split('T')[0],
                label: i === 0 ? '今天' : i === 1 ? '明天' : date.toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' })
            });
        }
        return dates;
    };

    // 生成时间选项（9:00 - 21:00，每小时一个）
    const getTimeOptions = () => {
        const times = [];
        for (let hour = 9; hour <= 21; hour++) {
            times.push({
                value: `${hour.toString().padStart(2, '0')}:00`,
                label: `${hour.toString().padStart(2, '0')}:00`
            });
            if (hour < 21) {
                times.push({
                    value: `${hour.toString().padStart(2, '0')}:30`,
                    label: `${hour.toString().padStart(2, '0')}:30`
                });
            }
        }
        return times;
    };

    const handleSend = async () => {
        if (!selectedDate || !selectedTime) {
            alert('请选择日期和时间');
            return;
        }

        setIsSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('请先登录');
                return;
            }

            const meetupDateTime = new Date(`${selectedDate}T${selectedTime}`);

            const meetupContent = JSON.stringify({
                datetime: meetupDateTime.toISOString(),
                date: selectedDate,
                time: selectedTime,
                location: location || '待确定',
                note: note || '',
                proposed_by: session.user.id,
                product_title: productTitle || '',
                status: 'proposed',
                timestamp: new Date().toISOString()
            });

            const { error } = await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: session.user.id,
                message_type: 'meetup_time',
                content: meetupContent,
                text: `📅 提议见面时间: ${selectedDate} ${selectedTime}`
            });

            if (error) throw error;

            // 清空表单
            setSelectedDate('');
            setSelectedTime('');
            setLocation('');
            setNote('');
            onSent?.();
        } catch (error) {
            console.error('Error sending meetup time:', error);
            alert('发送失败，请重试');
        } finally {
            setIsSending(false);
        }
    };

    const availableDates = getAvailableDates();
    const timeOptions = getTimeOptions();

    return (
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-5 border-2 border-amber-200 shadow-lg max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Calendar className="text-white" size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">约定见面时间</h4>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Product Title */}
            {productTitle && (
                <div className="mb-4 p-3 bg-white/60 rounded-lg">
                    <p className="text-sm text-gray-600">商品</p>
                    <p className="font-medium text-gray-900 truncate">{productTitle}</p>
                </div>
            )}

            {/* Date Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 选择日期
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {availableDates.map((date) => (
                        <button
                            key={date.value}
                            onClick={() => setSelectedDate(date.value)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${selectedDate === date.value
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                                    : 'bg-white text-gray-700 hover:bg-amber-50 border border-gray-200'
                                }`}
                        >
                            {date.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Time Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    🕐 选择时间
                </label>
                <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                >
                    <option value="">请选择时间</option>
                    {timeOptions.map((time) => (
                        <option key={time.value} value={time.value}>
                            {time.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Location Input */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    📍 见面地点（可选）
                </label>
                <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="例如：星巴克 改革大道店"
                    className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:border-amber-500"
                />
            </div>

            {/* Note Input */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    💬 备注（可选）
                </label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="补充说明..."
                    rows={2}
                    className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
                />
            </div>

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={isSending || !selectedDate || !selectedTime}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSending ? '发送中...' : '发送见面邀请'}
            </button>

            {/* Tips */}
            <p className="text-xs text-gray-500 text-center mt-3">
                💡 对方可以确认或建议新的时间
            </p>
        </div>
    );
};
