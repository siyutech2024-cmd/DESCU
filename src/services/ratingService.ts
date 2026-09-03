import { api } from '@/lib/api/client';

export interface RatingStats {
    total_reviews: number;
    average_rating: number;
}

export const EMPTY_RATING_STATS: RatingStats = { total_reviews: 0, average_rating: 0 };

export const submitRating = (raterId: string, targetUserId: string, score: number, comment: string) =>
    api.post('/api/ratings', { rater_id: raterId, target_user_id: targetUserId, score, comment }, { auth: 'required' });

export const getUserRatingStats = async (userId: string): Promise<RatingStats> => {
    try {
        const stats = await api.get<RatingStats | null>(`/api/ratings/${userId}/stats`);
        return stats || EMPTY_RATING_STATS;
    } catch {
        return EMPTY_RATING_STATS;
    }
};
