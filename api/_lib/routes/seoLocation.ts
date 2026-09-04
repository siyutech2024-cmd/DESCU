import { Router } from 'express';
import { ipLocationProxy, placeSearchProxy, reverseGeocodeProxy } from '../controllers/locationController.js';

/**
 * Geo-location proxies.
 * /sitemap.xml and /llms-full.txt are NOT served here: in production vercel.json
 * rewrites them to the standalone functions api/sitemap.ts and api/llms-full.ts
 * (server/dev.ts mounts the same handlers for local parity).
 */
export const seoLocationRouter = Router();
const router = seoLocationRouter;

router.get('/api/location/reverse', reverseGeocodeProxy);
router.get('/api/location/ip', ipLocationProxy);
router.get('/api/location/search', placeSearchProxy);
