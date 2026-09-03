import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';

export const submitRating = async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
        // The rater is ALWAYS the authenticated user — never trust a rater_id from the body.
        const rater_id = req.user?.id;
        const { target_user_id, score, comment } = req.body ?? {};

        if (!rater_id) return res.status(401).json({ error: 'Unauthorized' });
        if (typeof target_user_id !== 'string' || !target_user_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (target_user_id === rater_id) {
            return res.status(400).json({ error: 'You cannot rate yourself' });
        }
        const numericScore = Number(score);
        if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
            return res.status(400).json({ error: 'Score must be an integer between 1 and 5' });
        }
        const safeComment = typeof comment === 'string' ? comment.trim().slice(0, 1000) : null;

        const { data, error } = await supabase
            .from('ratings')
            .upsert({ rater_id, target_user_id, score: numericScore, comment: safeComment || null })
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error('Rating error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getUserRatingStats = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Use the view we created
        const { data, error } = await supabase
            .from('user_rating_stats')
            .select('*')
            .eq('target_user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows", which is fine
            throw error;
        }

        res.json(data || { total_reviews: 0, average_rating: 0 });
    } catch (error: any) {
        console.error('Get Stats error:', error);
        res.status(500).json({ error: error.message });
    }
};
