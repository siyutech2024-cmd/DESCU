/**
 * IndexNow API — Push-based indexing for search engines (Bing, Yandex, etc.)
 * Called after product creation/update to notify search engines immediately.
 * 
 * Usage: POST /api/indexnow  body: { urls: ["https://descu.ai/product/xxx"] }
 *   or : GET  /api/indexnow?url=https://descu.ai/product/xxx
 */

const INDEXNOW_KEY = 'descu-indexnow-key';
const SITE_HOST = 'descu.ai';
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`;

async function submitToIndexNow(urls: string[]): Promise<{ success: boolean; details: string }> {
    try {
        const payload = {
            host: SITE_HOST,
            key: INDEXNOW_KEY,
            keyLocation: KEY_LOCATION,
            urlList: urls
        };

        const response = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload)
        });

        // IndexNow returns 200/202 on success
        if (response.ok || response.status === 202) {
            return { success: true, details: `Submitted ${urls.length} URL(s), status: ${response.status}` };
        }

        return { success: false, details: `IndexNow returned ${response.status}: ${await response.text()}` };
    } catch (error: any) {
        return { success: false, details: `IndexNow error: ${error.message}` };
    }
}

export default async function handler(req: any, res: any) {
    try {
        let urls: string[] = [];

        if (req.method === 'POST') {
            // POST body: { urls: [...] } or { url: "..." }
            const body = req.body || {};
            if (Array.isArray(body.urls)) {
                urls = body.urls;
            } else if (body.url) {
                urls = [body.url];
            }
        } else if (req.method === 'GET') {
            // GET ?url=...
            const queryUrl = req.query?.url;
            if (queryUrl) urls = [queryUrl as string];
        }

        if (urls.length === 0) {
            return res.status(400).json({ error: 'No URLs provided. Use POST { urls: [...] } or GET ?url=...' });
        }

        // Validate all URLs belong to our domain
        urls = urls.filter(u => u.includes(SITE_HOST));

        if (urls.length === 0) {
            return res.status(400).json({ error: 'URLs must belong to descu.ai' });
        }

        // Cap at 10000 (IndexNow API limit)
        if (urls.length > 10000) urls = urls.slice(0, 10000);

        const result = await submitToIndexNow(urls);

        console.log('[IndexNow]', result.details);
        res.status(result.success ? 200 : 502).json(result);
    } catch (error: any) {
        console.error('[IndexNow] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Helper function for internal use — call from productController after create/update
 */
export async function notifyIndexNow(productId: string): Promise<void> {
    const url = `https://${SITE_HOST}/product/${productId}`;
    try {
        const result = await submitToIndexNow([url]);
        console.log(`[IndexNow] Product ${productId}:`, result.details);
    } catch (error) {
        // Silent fail — indexing is best-effort
        console.error(`[IndexNow] Failed for ${productId}:`, error);
    }
}
