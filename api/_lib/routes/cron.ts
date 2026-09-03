import { Router } from 'express';
import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { autoReviewPendingProducts } from '../services/auditService.js';

/**
 * Cron routes — triggered by Vercel Cron (x-vercel-cron header) or an external
 * scheduler holding CRON_SECRET (GitHub Actions, see .github/workflows).
 */
export const cronRouter = Router();

/**
 * Only a caller holding CRON_SECRET may run the job. The `x-vercel-cron` header is
 * NOT trusted: vercel.json defines no crons, and any client can set that header.
 */
const isAuthorizedCron = (req: Request): boolean => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return false;
    const authHeader = req.headers.authorization ?? '';
    const expected = `Bearer ${cronSecret}`;
    if (authHeader.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
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
