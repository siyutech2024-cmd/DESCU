import { Router } from 'express';
import { requireAuth } from '../middleware/userAuth.js';
import { getProductNegotiations, proposeNegotiation, respondToNegotiation } from '../controllers/negotiationController.js';

/**
 * Price negotiation routes (buyer proposes, seller accepts/rejects/counters).
 */
export const negotiationsRouter = Router();
const router = negotiationsRouter;

router.post('/api/negotiations/propose', requireAuth, proposeNegotiation);
router.post('/api/negotiations/:id/respond', requireAuth, respondToNegotiation);
router.get('/api/negotiations/product/:productId', requireAuth, getProductNegotiations);
