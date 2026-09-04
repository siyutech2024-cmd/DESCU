import { z } from 'zod';

/** Client-input schemas for /api/ratings (ratingController.ts). */

export const RatingUserIdParamSchema = z.object({ userId: z.string().uuid() });

export const RATING_MAX_COMMENT_LENGTH = 1000;

/**
 * Body of POST /api/ratings. The rater is always the authenticated user — a `rater_id` in the
 * body is ignored (stripped). Self-rating is rejected in the handler where the caller id is known.
 */
export const SubmitRatingSchema = z.object({
    target_user_id: z.string().uuid(),
    score: z.coerce.number().int('Score must be an integer between 1 and 5').min(1, 'Score must be an integer between 1 and 5').max(5, 'Score must be an integer between 1 and 5'),
    comment: z.string().trim().max(RATING_MAX_COMMENT_LENGTH).nullable().optional(),
});
export type SubmitRatingInput = z.infer<typeof SubmitRatingSchema>;
