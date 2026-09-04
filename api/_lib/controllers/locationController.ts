import { asyncHandler, badRequest } from '../lib/http.js';

/** Geo-location proxies (server-side to avoid CORS / expose no third-party keys). */

const MX_DEFAULT = { country: 'MX', city: 'Mexico City', countryName: 'Mexico' };

// Reverse Geocode Proxy
export const reverseGeocodeProxy = asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) throw badRequest('Latitude and longitude are required');

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'DescuMarketplace/1.0', 'Accept-Language': 'es, en' },
    });
    if (!response.ok) throw new Error(`Nominatim API Error: ${response.statusText}`);

    res.json(await response.json());
});

/**
 * IP → coarse location. Best-effort: localhost and any upstream failure answer with the
 * MX default instead of an error, since the client only uses it to pick a starting city.
 */
export const ipLocationProxy = asyncHandler(async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0] || req.socket.remoteAddress;
    if (!ip || ip === '::1' || ip === '127.0.0.1') return res.json(MX_DEFAULT);

    try {
        const fetchRes = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!fetchRes.ok) throw new Error('IP API failed');
        const data = await fetchRes.json();
        res.json({
            country: data.country_code || MX_DEFAULT.country,
            city: data.city || 'Unknown',
            countryName: data.country_name || MX_DEFAULT.countryName,
        });
    } catch (e: any) {
        console.error('IP Location Error:', e.message);
        res.json(MX_DEFAULT);
    }
});
