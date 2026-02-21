import React, { useState, useEffect } from 'react';
import { X, Star, User as UserIcon, Calendar, Shield, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { API_BASE_URL } from '../services/apiConfig';

const localeMap: Record<string, string> = {
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-MX'
};

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    userAvatar: string;
    currentUserId: string;
    canRate?: boolean; // 是否可以评分（已完成交易）
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen,
    onClose,
    userId,
    userName,
    userAvatar,
    currentUserId,
    canRate = false
}) => {
    const { t, language } = useLanguage();
    const [ratingStats, setRatingStats] = useState<{ total_reviews: number; average_rating: number }>({ total_reviews: 0, average_rating: 0 });
    const [myRating, setMyRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [memberSince, setMemberSince] = useState<string>('');

    useEffect(() => {
        if (!isOpen || !userId) return;

        // 获取评分统计
        fetch(`${API_BASE_URL}/api/ratings/${userId}/stats`)
            .then(r => r.json())
            .then(data => {
                setRatingStats(data || { total_reviews: 0, average_rating: 0 });
            })
            .catch(console.error);

        // 获取用户注册时间
        import('../services/supabase').then(({ supabase }) => {
            supabase.from('users').select('created_at').eq('id', userId).single()
                .then(({ data }) => {
                    if (data?.created_at) {
                        setMemberSince(new Date(data.created_at).toLocaleDateString(localeMap[language] || 'en-US', {
                            year: 'numeric', month: 'short'
                        }));
                    }
                });
        });
    }, [isOpen, userId]);

    const handleSubmitRating = async () => {
        if (myRating === 0 || isSubmitting) return;
        setIsSubmitting(true);

        try {
            const { supabase } = await import('../services/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Auth required');

            const res = await fetch(`${API_BASE_URL}/api/ratings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    rater_id: currentUserId,
                    target_user_id: userId,
                    score: myRating,
                    comment: comment.trim() || null
                })
            });

            if (!res.ok) throw new Error('Failed to submit rating');

            setHasRated(true);
            // 刷新统计
            const statsRes = await fetch(`${API_BASE_URL}/api/ratings/${userId}/stats`);
            const stats = await statsRes.json();
            setRatingStats(stats || { total_reviews: 0, average_rating: 0 });
        } catch (err) {
            console.error('Rating error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const renderStars = (rating: number, size: number = 16, interactive: boolean = false) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                    <Star
                        key={star}
                        size={size}
                        className={`transition-all duration-150 ${star <= (interactive ? (hoveredStar || myRating) : Math.round(rating))
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                            } ${interactive ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}`}
                        onClick={interactive ? () => setMyRating(star) : undefined}
                        onMouseEnter={interactive ? () => setHoveredStar(star) : undefined}
                        onMouseLeave={interactive ? () => setHoveredStar(0) : undefined}
                    />
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[201] max-w-sm mx-auto animate-fade-in-up">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* 头部背景 */}
                    <div className="relative h-28 bg-gradient-to-br from-brand-500 via-brand-400 to-pink-400">
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                        >
                            <X size={18} />
                        </button>
                        {/* 大头像 */}
                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                            <img
                                src={userAvatar}
                                alt={userName}
                                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                            />
                        </div>
                    </div>

                    {/* 用户信息 */}
                    <div className="pt-14 pb-4 px-6 text-center">
                        <h2 className="text-xl font-bold text-gray-900">{userName}</h2>

                        <div className="flex items-center justify-center gap-4 mt-3">
                            {/* 评分 */}
                            <div className="flex items-center gap-1.5">
                                {renderStars(ratingStats.average_rating)}
                                <span className="text-sm font-bold text-gray-700 ml-1">
                                    {ratingStats.average_rating > 0 ? ratingStats.average_rating.toFixed(1) : '-'}
                                </span>
                            </div>
                        </div>

                        {/* 统计卡片 */}
                        <div className="flex gap-3 mt-4">
                            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                                    <MessageCircle size={13} />
                                    <span className="text-[11px] font-medium leading-none">{t('profile.reviews')}</span>
                                </div>
                                <p className="text-base font-bold text-gray-900 mt-1">{ratingStats.total_reviews}</p>
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                                    <Calendar size={13} />
                                    <span className="text-[11px] font-medium leading-none">{t('profile.member_since')}</span>
                                </div>
                                <p className="text-[13px] font-bold text-gray-900 mt-1 whitespace-nowrap">{memberSince || '-'}</p>
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                                    <Shield size={13} />
                                    <span className="text-[11px] font-medium leading-none">{t('profile.trust')}</span>
                                </div>
                                <p className="text-base font-bold text-gray-900 mt-1">
                                    {ratingStats.average_rating >= 4.5 ? '⭐' : ratingStats.average_rating >= 3 ? '✅' : '🆕'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 评分区域 */}
                    {canRate && userId !== currentUserId && !hasRated && (
                        <div className="border-t border-gray-100 px-6 py-4">
                            <p className="text-sm font-bold text-gray-700 mb-3">{t('profile.rate_user')}</p>
                            <div className="flex justify-center mb-3">
                                {renderStars(0, 28, true)}
                            </div>
                            {myRating > 0 && (
                                <div className="space-y-3 animate-fade-in">
                                    <textarea
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                        placeholder={t('profile.rate_comment')}
                                        className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
                                        rows={2}
                                    />
                                    <button
                                        onClick={handleSubmitRating}
                                        disabled={isSubmitting}
                                        className="w-full py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-bold text-sm hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-50"
                                    >
                                        {isSubmitting ? t('profile.submitting') : t('profile.submit_rating')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 已评分提示 */}
                    {hasRated && (
                        <div className="border-t border-gray-100 px-6 py-4 text-center">
                            <p className="text-sm text-green-600 font-medium">✅ {t('profile.rated_success')}</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
