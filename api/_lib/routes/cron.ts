import { Router } from 'express';
import type { Request, Response } from 'express';
import { autoReviewPendingProducts } from '../services/auditService.js';

/**
 * Cron routes — triggered by Vercel Cron (x-vercel-cron header) or an external
 * scheduler holding CRON_SECRET (GitHub Actions, see .github/workflows).
 */
export const cronRouter = Router();

const isAuthorizedCron = (req: Request): boolean => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const isAuthorized = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    return isVercelCron || isAuthorized;
};

/**
 * 自动商品审核定时任务
 * 每小时执行一次，自动审核新上架的商品
 */
const runAutoReview = async (req: Request, res: Response) => {
    try {
        if (!isAuthorizedCron(req)) {
            console.warn('[Cron] Unauthorized access attempt to auto-review');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`[Cron] Starting auto-review job (${req.method})...`);
        const stats = await autoReviewPendingProducts(50);
        console.log('[Cron] Auto-review completed:', stats);

        res.json({
            success: true,
            message: 'Auto-review completed',
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('[Cron] Auto-review failed:', error);
        res.status(500).json({ error: 'Auto-review failed', message: error.message });
    }
};

cronRouter.post('/api/cron/auto-review', runAutoReview);
// Vercel Cron 默认使用 GET
cronRouter.get('/api/cron/auto-review', runAutoReview);
