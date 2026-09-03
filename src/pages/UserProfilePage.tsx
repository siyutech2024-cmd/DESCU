import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Calendar, Shield, MessageCircle, ShoppingBag, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { API_BASE_URL } from '../services/apiConfig';
import { supabase } from '../services/supabase';

const localeMap: Record<string, string> = {
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-MX'
};

interface UserProfilePageProps {
    currentUserId?: string;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ currentUserId }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t, language } = useLanguage();

    const [userInfo, setUserInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState({ total_reviews: 0, average_rating: 0 });
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [myRating, setMyRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasRated, setHasRated] = useState(false);

    useEffect(() => {
        if (!id) return;
        setIsLoading(true);

        // Fetch user profile
        supabase.from('users').select('*').eq('id', id).single()
            .then(({ data }) => {
                if (data) setUserInfo(data);
            });

        // Fetch rating stats
        fetch(`${API_BASE_URL}/api/ratings/${id}/stats`)
            .then(r => r.json())
            .then(data => setRatingStats(data || { total_reviews: 0, average_rating: 0 }))
            .catch(console.error);

        // Fetch user products
        fetch(`${API_BASE_URL}/api/products?seller_id=${id}&limit=20`)
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setProducts(data);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [id]);

    const handleSubmitRating = async () => {
        if (myRating === 0 || isSubmitting || !currentUserId || !id) return;
        setIsSubmitting(true);
        try {
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
                    target_user_id: id,
                    score: myRating,
                    comment: comment.trim() || null
                })
            });
            if (!res.ok) throw new Error('Failed');
            setHasRated(true);
            // Refresh stats
            const statsRes = await fetch(`${API_BASE_URL}/api/ratings/${id}/stats`);
            const stats = await statsRes.json();
            setRatingStats(stats || { total_reviews: 0, average_rating: 0 });
        } catch (err) {
            console.error('Rating error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStars = (rating: number, size: number = 16, interactive = false) => (
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

    if (isLoading || !userInfo) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const memberSince = userInfo.created_at
        ? new Date(userInfo.created_at).toLocaleDateString(localeMap[language] || 'en-US', { year: 'numeric', month: 'short' })
        : '-';

    return (
        <div className="max-w-2xl mx-auto pb-28 sm:pb-8 animate-fade-in">
            {/* Header */}
            <div className="relative">
                <div className="h-36 bg-gradient-to-br from-brand-500 via-brand-400 to-pink-400" />
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Avatar */}
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
                    <img
                        src={userInfo.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`}
                        alt={userInfo.name}
                        className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl"
                    />
                </div>
            </div>

            {/* User Info */}
            <div className="pt-16 pb-4 px-6 text-center">
                <h1 className="text-2xl font-black text-gray-900">{userInfo.name || id?.slice(0, 8)}</h1>

                {userInfo.city && (
                    <div className="flex items-center justify-center gap-1 mt-1 text-sm text-gray-500">
                        <MapPin size={14} />
                        <span>{userInfo.city}{userInfo.country ? `, ${userInfo.country}` : ''}</span>
                    </div>
                )}

                <div className="flex items-center justify-center gap-2 mt-3">
                    {renderStars(ratingStats.average_rating, 20)}
                    <span className="text-lg font-bold text-gray-700 ml-1">
                        {ratingStats.average_rating > 0 ? Number(ratingStats.average_rating).toFixed(1) : '-'}
                    </span>
                </div>

                {/* Stats */}
                <div className="flex gap-3 mt-5">
                    <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                            <MessageCircle size={14} />
                            <span className="text-xs font-medium">{t('profile.reviews')}</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{ratingStats.total_reviews}</p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                            <Calendar size={14} />
                            <span className="text-xs font-medium">{t('profile.member_since')}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 mt-1">{memberSince}</p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                            <Shield size={14} />
                            <span className="text-xs font-medium">{t('profile.trust')}</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">
                            {ratingStats.average_rating >= 4.5 ? '⭐' : ratingStats.average_rating >= 3 ? '✅' : '🆕'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Rating Section */}
            {currentUserId && currentUserId !== id && !hasRated && (
                <div className="mx-6 mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-sm font-bold text-gray-700 mb-3">{t('profile.rate_user')}</p>
                    <div className="flex justify-center mb-3">
                        {renderStars(0, 32, true)}
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
                                className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-bold text-sm hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-50 shadow-lg"
                            >
                                {isSubmitting ? t('profile.submitting') : t('profile.submit_rating')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {hasRated && (
                <div className="mx-6 mb-6 bg-green-50 rounded-2xl p-4 text-center border border-green-100">
                    <p className="text-sm text-green-600 font-medium">✅ {t('profile.rated_success')}</p>
                </div>
            )}

            {/* Products */}
            <div className="px-6">
                <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag size={18} className="text-gray-600" />
                    <h2 className="text-lg font-bold text-gray-900">
                        {t('profile.user_products')} ({products.length})
                    </h2>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{t('profile.no_products')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {products.map((p: any) => (
                            <div
                                key={p.id}
                                onClick={() => navigate(`/product/${p.id}`)}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.97]"
                            >
                                <img
                                    src={p.images?.[0] || ''}
                                    alt={p.title}
                                    className="w-full h-32 object-cover"
                                />
                                <div className="p-3">
                                    <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                                    <p className="text-sm font-bold text-brand-600 mt-1">${p.price} {p.currency || ''}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
