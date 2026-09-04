import { Router } from 'express';
import { requireCronSecret, runAutoReview, runExpireOrders } from '../controllers/cronController.js';

/**
 * Cron routes — triggered by an external scheduler holding CRON_SECRET
 * (GitHub Actions, see .github/workflows). Both GET and POST are accepted
 * because Vercel Cron defaults to GET.
 */
export const cronRouter = Router();
const router = cronRouter;

router.post('/api/cron/auto-review', requireCronSecret, runAutoReview);
router.get('/api/cron/auto-review', requireCronSecret, runAutoReview);
router.post('/api/cron/expire-orders', requireCronSecret, runExpireOrders);
router.get('/api/cron/expire-orders', requireCronSecret, runExpireOrders);
