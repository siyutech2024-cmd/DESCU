import { API_BASE_URL } from './apiConfig';

export const submitRating = async (raterId: string, targetUserId: string, score: number, comment: string) => {
    const response = await fetch(`${API_BASE_URL}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rater_id: raterId, target_user_id: targetUserId, score, comment }),
    });
    if (!response.ok) throw new Error('Failed to submit rating');
    return response.json();
};

export const getUserRatingStats = async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/ratings/${userId}/stats`);
    if (!response.ok) return { total_reviews: 0, average_rating: 0 };
    return response.json();
};
