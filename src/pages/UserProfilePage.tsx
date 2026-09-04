import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, Calendar, Shield, MessageCircle, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryClient';
import { getUserRatingStats, EMPTY_RATING_STATS } from '@/services/ratingService';
import { useBackNavigation } from '@/lib/useBackNavigation';

const localeMap: Record<string, string> = {
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-MX'
};

/** Public profile as served by `GET /api/users/:userId`. */
interface PublicUser {
    id: string;
    name: string | null;
    avatar_url: string | null;
    created_at: string | null;
}

interface SellerProduct {
    id: string;
    title?: string;
    price?: number;
    currency?: string | null;
    images?: string[] | null;
}

const fetchPublicUser = async (userId: string): Promise<PublicUser | null> => {
    const data = await api.get<{ user?: PublicUser | null }>(`/api/users/${encodeURIComponent(userId)}`);
    return data?.user ?? null;
};

const fetchSellerProducts = async (sellerId: string): Promise<SellerProduct[]> => {
    const data = await api.get<SellerProduct[]>('/api/products', { params: { seller_id: sellerId, limit: 20 } });
    return Array.isArray(data) ? data : [];
};

interface UserProfilePageProps {
    currentUserId?: string;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ currentUserId }) => {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const goBack = useBackNavigation('/');
    const { t, language } = useLanguage();
    const queryClient = useQueryClient();

    const [myRating, setMyRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasRated, setHasRated] = useState(false);

    const userQuery = useQuery({
        queryKey: queryKeys.publicUser(id),
        queryFn: () => fetchPublicUser(id),
        enabled: !!id,
    });
    const { data: ratingStats = EMPTY_RATING_STATS } = useQuery({
        queryKey: queryKeys.ratings(id),
        queryFn: () => getUserRatingStats(id),
        enabled: !!id,
    });
    const productsQuery = useQuery({
        queryKey: queryKeys.products.bySeller(id),
        queryFn: () => fetchSellerProducts(id),
        enabled: !!id,
    });

    const userInfo = userQuery.data ?? null;
    const products = productsQuery.data ?? [];
    const isLoading = userQuery.isLoading || productsQuery.isLoading;

    const handleSubmitRating = async () => {
        if (myRating === 0 || isSubmitting || !currentUserId || !id) return;
        setIsSubmitting(true);
        try {
            await api.post('/api/ratings', {
                rater_id: currentUserId,
                target_user_id: id,
                score: myRating,
                comment: comment.trim() || null
            }, { auth: 'required' });
            setHasRated(true);
            // Refresh stats
            await queryClient.invalidateQueries({ queryKey: queryKeys.ratings(id) });
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!userInfo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
                <p className="text-sm text-gray-500">{t('profile.user_not_found')}</p>
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"
                >
                    <ArrowLeft size={16} />
                    {t('detail.back')}
                </button>
            </div>
        );
    }

    const memberSince = userInfo.created_at
        ? new Date(userInfo.created_at).toLocaleDateString(localeMap[language] || 'en-US', { year: 'numeric', month: 'short' })
        : '-';

    return (
        <div className="max-w-2xl mx-auto pb-8 animate-fade-in">
            {/* Header */}
            <div className="relative">
                <div className="h-36 bg-gradient-to-br from-brand-500 via-brand-400 to-pink-400" />
                <button
                    onClick={goBack}
                    className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Avatar */}
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
                    <img
                        src={userInfo.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`}
                        alt={userInfo.name ?? ''}
                        className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl"
                    />
                </div>
            </div>

            {/* User Info */}
            <div className="pt-16 pb-4 px-6 text-center">
                <h1 className="text-2xl font-black text-gray-900">{userInfo.name || id.slice(0, 8)}</h1>

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
                            <textarea maxLength={1000}
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
                        {products.map(p => (
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
