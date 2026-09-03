import { Router } from 'express';
import { requireAuth } from '../middleware/userAuth.js';
import { submitRating, getUserRatingStats } from '../controllers/ratingController.js';

/** User ratings & reviews. */
export const ratingsRouter = Router();

ratingsRouter.post('/api/ratings', requireAuth, submitRating);
ratingsRouter.get('/api/ratings/:userId/stats', getUserRatingStats);
