import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, Calendar, ShoppingBag, UserX, CheckCircle } from 'lucide-react';
import { useRegion } from '@/contexts/RegionContext';
import { Button, Card, Chip, EmptyState, IconButton, inputClass } from '@/components/ui/primitives';
import { useLanguage, localeFor } from '@/i18n';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryClient';
import { getUserRatingStats, EMPTY_RATING_STATS } from '@/services/ratingService';
import { useBackNavigation } from '@/lib/useBackNavigation';

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
    const { formatCurrency } = useRegion();
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
                <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!userInfo) {
        return (
            <EmptyState icon={<UserX size={26} />} title={t('profile.user_not_found')} className="min-h-[60vh]"
                action={<Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={goBack}>{t('detail.back')}</Button>} />
        );
    }

    const memberSince = userInfo.created_at
        ? new Date(userInfo.created_at).toLocaleDateString(localeFor(language), { year: 'numeric', month: 'short' })
        : '—';
    const avatarUrl = userInfo.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;

    return (
        <div className="max-w-3xl mx-auto w-full px-4 pt-4 pb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
                <IconButton onClick={goBack} aria-label={t('detail.back')} className="-ml-2"><ArrowLeft size={22} /></IconButton>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('detail.seller')}</h1>
            </div>

            <Card className="mb-4">
                <div className="flex items-center gap-4">
                    <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover bg-gray-100 ring-4 ring-white shadow-md flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xl font-black text-gray-900 truncate">{userInfo.name || id.slice(0, 8)}</p>
                        <div className="mt-1 flex items-center gap-2">
                            {renderStars(ratingStats.average_rating, 16)}
                            <span className="text-sm font-bold text-gray-700 tabular-nums">{ratingStats.average_rating > 0 ? Number(ratingStats.average_rating).toFixed(1) : '—'}</span>
                            <span className="text-sm text-gray-500">· {ratingStats.total_reviews} {t('profile.reviews')}</span>
                        </div>
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-500"><Calendar size={12} />{t('profile.member_since')} {memberSince}</p>
                    </div>
                </div>
            </Card>

            {currentUserId && currentUserId !== id && !hasRated && (
                <Card className="mb-4">
                    <p className="text-sm font-bold text-gray-900 mb-3">{t('profile.rate_user')}</p>
                    <div className="flex justify-center mb-3">{renderStars(0, 32, true)}</div>
                    {myRating > 0 && (
                        <div className="space-y-3 animate-fade-in">
                            <textarea maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} placeholder={t('profile.rate_comment')} className={`${inputClass} resize-none`} rows={2} />
                            <Button block onClick={handleSubmitRating} loading={isSubmitting}>{t('profile.submit_rating')}</Button>
                        </div>
                    )}
                </Card>
            )}
            {hasRated && (
                <p className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700"><CheckCircle size={16} />{t('profile.rated_success')}</p>
            )}

            <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-bold text-gray-900">{t('profile.user_products')}</h2>
                <Chip tone="neutral">{products.length}</Chip>
            </div>
            {products.length === 0 ? (
                <EmptyState icon={<ShoppingBag size={26} />} title={t('profile.no_products')} className="bg-white rounded-2xl border border-gray-100" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.map(p => (
                        <button key={p.id} type="button" onClick={() => navigate(`/product/${p.id}`)} className="text-left bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                            <img src={p.images?.[0] || ''} alt="" className="w-full aspect-square object-cover bg-gray-100" loading="lazy" />
                            <div className="p-3">
                                <p className="text-sm font-bold text-gray-900 truncate">{p.title}</p>
                                <p className="text-sm font-black text-gray-900 mt-0.5 tabular-nums">{formatCurrency(Number(p.price) || 0, p.currency || 'MXN')}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
