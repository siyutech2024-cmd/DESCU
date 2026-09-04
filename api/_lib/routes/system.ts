import { Router } from 'express';

/** Diagnostics / health endpoints. */
export const systemRouter = Router();
const router = systemRouter;

/**
 * Build/deploy identifier, cheaply: the commit Vercel deployed, else the npm
 * package version when started via `npm run server`, else 'dev'.
 */
const resolveVersion = (): string =>
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
    || process.env.npm_package_version
    || 'dev';

/**
 * Liveness + configuration check. Reports only whether each integration's
 * env var is present — never values, never filesystem contents.
 */
router.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        version: resolveVersion(),
        services: {
            supabase: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
            stripe: !!process.env.STRIPE_SECRET_KEY,
            gemini: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
        },
    });
});

router.get('/', (_req, res) => {
    res.send('DESCU API');
});
