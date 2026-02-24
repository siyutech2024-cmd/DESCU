
import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';

export const generateSitemap = async (req: any, res: any) => {
    try {
        const baseUrl = 'https://descu.ai';
        const today = new Date().toISOString().split('T')[0];

        // 1. Static Routes
        const staticRoutes = [
            { loc: '/', priority: '1.0', changefreq: 'daily' },
            { loc: '/privacy-policy', priority: '0.4', changefreq: 'monthly' },
        ];

        // 2. Category Pages — high SEO value for Mexico search
        const categories = [
            'Electronics', 'Vehicles', 'RealEstate', 'Furniture',
            'Clothing', 'Sports', 'Books', 'Services', 'Other'
        ];
        const categoryRoutes = categories.map(cat => ({
            loc: `/?category=${cat}`,
            priority: '0.8',
            changefreq: 'daily'
        }));

        // 3. Fetch active products
        const { data: products } = await supabase
            .from('products')
            .select('id, updated_at, category, title')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(2000);

        // 4. Generate XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

        // Static pages
        for (const route of staticRoutes) {
            xml += `
  <url>
    <loc>${baseUrl}${route.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
    <xhtml:link rel="alternate" hreflang="es-MX" href="${baseUrl}${route.loc}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${route.loc}" />
  </url>`;
        }

        // Category pages
        for (const route of categoryRoutes) {
            xml += `
  <url>
    <loc>${baseUrl}${route.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
        }

        // Product pages
        if (products) {
            for (const p of products) {
                const lastmod = p.updated_at
                    ? new Date(p.updated_at).toISOString().split('T')[0]
                    : today;
                xml += `
  <url>
    <loc>${baseUrl}/product/${p.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
            }
        }

        xml += `
</urlset>`;

        // 5. Response
        if (typeof res.setHeader === 'function') {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        } else if (typeof res.header === 'function') {
            res.header('Content-Type', 'application/xml; charset=utf-8');
            res.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        }

        if (typeof res.status === 'function') {
            res.status(200);
        } else {
            res.statusCode = 200;
        }

        if (typeof res.send === 'function') {
            res.send(xml);
        } else if (typeof res.end === 'function') {
            res.end(xml);
        }

    } catch (error) {
        console.error('Sitemap Error:', error);
        if (res.statusCode) res.statusCode = 500;
        if (typeof res.status === 'function') res.status(500);
        if (typeof res.end === 'function') res.end('Error generating sitemap');
        else if (typeof res.send === 'function') res.send('Error generating sitemap');
    }
};

/**
 * llms-full.txt — 动态生成所有产品的完整文本摘要
 * AI 搜索引擎可一次性读取全站内容
 */
export const generateLlmsFull = async (req: any, res: any) => {
    try {
        const { data: products } = await supabase
            .from('products')
            .select('id, title, title_es, title_en, description, description_es, description_en, price, currency, category, subcategory, city, location_name, status')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(500);

        let txt = `# DESCU — Full Product Catalog\n`;
        txt += `> Generated: ${new Date().toISOString()}\n`;
        txt += `> Total active products: ${products?.length || 0}\n\n`;
        txt += `DESCU is Mexico's AI-powered secondhand marketplace. Buy and sell used items near you.\n`;
        txt += `Website: https://descu.ai\n\n`;
        txt += `---\n\n`;

        if (products) {
            for (const p of products) {
                const title = p.title_es || p.title_en || p.title || 'Untitled';
                const desc = p.description_es || p.description_en || p.description || '';
                const price = p.price ? `${p.price} ${p.currency || 'MXN'}` : 'Contact seller';
                txt += `## ${title}\n`;
                txt += `- URL: https://descu.ai/product/${p.id}\n`;
                txt += `- Price: ${price}\n`;
                txt += `- Category: ${p.category || 'Other'}${p.subcategory ? ` > ${p.subcategory}` : ''}\n`;
                txt += `- Location: ${p.city || p.location_name || 'Mexico'}\n`;
                if (desc) txt += `- Description: ${desc.substring(0, 200)}\n`;
                txt += `\n`;
            }
        }

        txt += `---\n`;
        txt += `© 2024 DESCU. AI-Powered Secondhand Marketplace in Mexico.\n`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        res.status(200).send(txt);
    } catch (error) {
        console.error('llms-full.txt Error:', error);
        res.status(500).send('Error generating llms-full.txt');
    }
};

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
