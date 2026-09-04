/**
 * Search-engine notification helpers (fired after a product is published).
 * The sitemap / llms-full.txt generators live in api/sitemap.ts and api/llms-full.ts.
 */

/**
 * IndexNow — 主动通知 Bing/Yandex 新 URL 变更
 */
const INDEXNOW_KEY = 'e8f4a2b1c3d5e6f7a8b9c0d1e2f3a4b5';

export const notifyIndexNow = async (urls: string[]) => {
    try {
        const body = {
            host: 'descu.ai',
            key: INDEXNOW_KEY,
            keyLocation: `https://descu.ai/${INDEXNOW_KEY}.txt`,
            urlList: urls,
        };

        const response = await fetch('https://api.indexnow.org/IndexNow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(body),
        });

        console.log(`[IndexNow] Notified ${urls.length} URLs, status: ${response.status}`);
        return response.status;
    } catch (error) {
        console.error('[IndexNow] Error:', error);
        return 0;
    }
};

/**
 * Google Sitemap Ping — 通知 Google 更新 sitemap
 */
export const pingGoogleSitemap = async () => {
    try {
        const response = await fetch('https://www.google.com/ping?sitemap=https://descu.ai/sitemap.xml');
        console.log(`[Google Ping] Status: ${response.status}`);
        return response.status;
    } catch (error) {
        console.error('[Google Ping] Error:', error);
        return 0;
    }
};
