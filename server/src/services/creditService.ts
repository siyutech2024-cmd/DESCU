import { supabase } from '../db/supabase';

// Credit Score Rules
const SCORES = {
    ORDER_COMPLETION: 10,  // Successful sale
    FIVE_STAR_RATING: 5,   // Good review
    ONE_STAR_RATING: -10,  // Bad review
    DISPUTE_LOST: -20,     // Seller lost dispute (item fake/not received)
    DISPUTE_WON: 5,        // Seller won dispute (false claim)
    INITIAL_SCORE: 100     // Starting score
};

export const updateCreditScore = async (
    userId: string,
    changeAmount: number,
    reason: string,
    relatedEntityId?: string // order_id or dispute_id
) => {
    try {
        // 1. Get current score or create entry
        const { data: current, error: fetchError } = await supabase
            .from('credit_scores')
            .select('score, history')
            .eq('user_id', userId)
            .single();

        let newScore = SCORES.INITIAL_SCORE;
        let history: any[] = [];

        if (current) {
            newScore = current.score;
            history = current.history || [];
        }

        // 2. Calculate new score
        newScore += changeAmount;
        // Cap score between 0 and 1000 (example range)
        newScore = Math.max(0, Math.min(1000, newScore));

        // 3. Add to history
        const historyEntry = {
            date: new Date().toISOString(),
            amount: changeAmount,
            reason,
            relatedId: relatedEntityId,
            resultScore: newScore
        };
        history.unshift(historyEntry); // Add to beginning
        // Keep history limited to last 50 entries
        if (history.length > 50) history.pop();

        // 4. Upsert
        const { error: upsertError } = await supabase
            .from('credit_scores')
            .upsert({
                user_id: userId,
                score: newScore,
                history: history,
                updated_at: new Date()
            });

        if (upsertError) throw upsertError;

        return newScore;

    } catch (error) {
        console.error('Failed to update credit score', error);
        // Don't throw, just log. Credit updates shouldn't block main transaction flow?
        // Actually, maybe better to return success/fail.
        return null;
    }
};

export const getCreditScore = async (userId: string) => {
    const { data } = await supabase
        .from('credit_scores')
        .select('score')
        .eq('user_id', userId)
        .single();
    return data?.score || SCORES.INITIAL_SCORE;
};
