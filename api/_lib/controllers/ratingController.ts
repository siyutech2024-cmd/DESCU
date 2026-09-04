import type { Request } from 'express';
import { supabase } from '../db/supabase.js';
import { asyncHandler, badRequest, parseBody, parseParams, unauthorized } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { RatingUserIdParamSchema, SubmitRatingSchema } from '../schemas/ratings.js';

export const submitRating = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    // The rater is ALWAYS the authenticated user — never trust a rater_id from the body.
    const rater_id = req.user?.id;
    if (!rater_id) throw unauthorized();

    const { target_user_id, score, comment } = parseBody(SubmitRatingSchema, req.body);
    if (target_user_id === rater_id) throw badRequest('You cannot rate yourself');

    const { data, error } = await supabase
        .from('ratings')
        .upsert({ rater_id, target_user_id, score, comment: comment || null })
        .select()
        .single();
    if (error) throw error;

    res.json(data);
});

export const getUserRatingStats = asyncHandler<Request>(async (req, res) => {
    const { userId } = parseParams(RatingUserIdParamSchema, req.params);

    // Use the view we created
    const { data, error } = await supabase
        .from('user_rating_stats')
        .select('*')
        .eq('target_user_id', userId)
        .single();

    // PGRST116 is "no rows", which is fine — a user without ratings gets the empty stats.
    if (error && error.code !== 'PGRST116') throw error;

    res.json(data || { total_reviews: 0, average_rating: 0 });
});
