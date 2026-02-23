
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
