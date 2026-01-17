import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';

export const submitRating = async (req: Request, res: Response) => {
    try {
        const { rater_id, target_user_id, score, comment } = req.body;

        if (!rater_id || !target_user_id || !score) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('ratings')
            .upsert({ rater_id, target_user_id, score, comment })
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
