import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { asyncHandler, unauthorized } from '../lib/http.js';
import { autoReviewPendingProducts } from '../services/auditService.js';
import { expireUnpaidOrders } from '../services/orderTransitionService.js';

/**
 * Cron job handlers — triggered by an external scheduler holding CRON_SECRET
 * (GitHub Actions, see .github/workflows).
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
 * Only a caller holding CRON_SECRET may run a job. The `x-vercel-cron` header is
 * NOT trusted: vercel.json defines no crons, and any client can set that header.
 */
export const requireCronSecret = (req: Request, _res: Response, next: NextFunction) => {
    if (!isAuthorizedCron(req)) {
        console.warn(`[Cron] Unauthorized access attempt to ${req.path}`);
        return next(unauthorized());
    }
    next();
};

/** Auto-review newly listed products (hourly). */
export const runAutoReview = asyncHandler(async (req, res) => {
    console.log(`[Cron] Starting auto-review job (${req.method})...`);
    const stats = await autoReviewPendingProducts(50);
    console.log('[Cron] Auto-review completed:', stats);

    res.json({ success: true, message: 'Auto-review completed', stats, timestamp: new Date().toISOString() });
});

/**
 * Expire unpaid online orders (pending_payment past expires_at + grace) → cancelled,
 * and put their products back on sale. See domain/orderStatus.ts for the window.
 */
export const runExpireOrders = asyncHandler(async (_req, res) => {
    const result = await expireUnpaidOrders(200);
    console.log('[Cron] expire-orders:', result);

    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
});
