import { Router } from 'express';
import { generateSitemap, generateLlmsFull } from '../controllers/seoController.js';
import { reverseGeocodeProxy } from '../controllers/locationController.js';

/** SEO artefacts served by the API and geo-location proxies. */
export const seoLocationRouter = Router();
const router = seoLocationRouter;

router.get('/sitemap.xml', generateSitemap);
router.get('/llms-full.txt', generateLlmsFull);
router.get('/api/location/reverse', reverseGeocodeProxy);

// New IP Location Proxy
router.get('/api/location/ip', async (req, res) => {
    try {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;

        // If localhost, return dummy data
        if (!ip || ip === '::1' || ip === '127.0.0.1') {
            return res.json({ country: 'MX', city: 'Mexico City', countryName: 'Mexico' });
        }

        const fetchRes = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!fetchRes.ok) throw new Error('IP API failed');

        const data = await fetchRes.json();
        res.json({
            country: data.country_code || 'MX',
            city: data.city || 'Unknown',
            countryName: data.country_name || 'Mexico'
        });
    } catch (e: any) {
        console.error('IP Location Error:', e.message);
        // Fallback to MX default instead of erroring 500
        res.json({ country: 'MX', city: 'Mexico City', countryName: 'Mexico' });
    }
});
