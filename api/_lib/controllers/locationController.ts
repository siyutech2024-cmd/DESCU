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
 * Place search (Nominatim), biased to Mexico. Returns a compact list the chat location
 * picker can show: `{ name, address, lat, lng }`.
 */
export const placeSearchProxy = asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) throw badRequest('Query too short');
    const lang = req.query.lang === 'en' ? 'en, es' : req.query.lang === 'zh' ? 'zh, es' : 'es, en';
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=mx&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'DescuMarketplace/1.0', 'Accept-Language': lang },
    });
    if (!response.ok) throw new Error(`Nominatim API Error: ${response.statusText}`);
    const rows = (await response.json()) as Array<{ lat: string; lon: string; display_name: string; name?: string; address?: Record<string, string> }>;
    res.json(rows.map(r => {
        const a = r.address ?? {};
        const name = r.name || a.amenity || a.shop || a.road || r.display_name.split(',')[0];
        const parts = [a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village || a.municipality, a.state].filter(Boolean);
        return { name, address: parts.join(', ') || r.display_name, lat: Number(r.lat), lng: Number(r.lon) };
    }));
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
