
import { Request, Response } from 'express';
import { supabase } from '../db/supabase';

// Helper to get safe headers (compatible with Express and Vercel/Node)
const getHeader = (req: any, name: string) => {
    if (req.headers && req.headers[name.toLowerCase()]) return req.headers[name.toLowerCase()];
    if (req.get && typeof req.get === 'function') return req.get(name);
    return null;
};

export const generateSitemap = async (req: any, res: any) => {
    try {
        // 1. Determine Protocol & Host
        const host = getHeader(req, 'host') || 'www.descu.ai';
        const forwardedProto = getHeader(req, 'x-forwarded-proto') || getHeader(req, 'x-scheme');

        const protocol = forwardedProto ? (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) : 'https';
        const baseUrl = `${protocol}://${host}`;

        const staticRoutes = [
            '',
            '/chat',
            '/profile'
        ];

        // 2. Fetch Products
        const { data: products } = await supabase
            .from('products')
            .select('id, updated_at')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1000);

        // 3. Generate XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        // Add Static
        staticRoutes.forEach(route => {
            xml += `
   <url>
      <loc>${baseUrl}${route}</loc>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
   </url>`;
        });

        // Add Products
        if (products) {
            products.forEach(p => {
                xml += `
   <url>
      <loc>${baseUrl}/product/${p.id}</loc>
      <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>1.0</priority>
   </url>`;
            });
        }

        xml += `
</urlset>`;

        // Compatible Response Handling
        // Set Header
        if (typeof res.setHeader === 'function') {
            res.setHeader('Content-Type', 'application/xml');
        } else if (typeof res.header === 'function') {
            res.header('Content-Type', 'application/xml');
        }

        // Set Status
        if (typeof res.status === 'function') {
            res.status(200);
        } else {
            res.statusCode = 200;
        }

        // Send Body
        if (typeof res.send === 'function') {
            res.send(xml);
        } else if (typeof res.end === 'function') {
            res.end(xml);
        } else {
            console.error('Unknown response object structure', res);
        }

    } catch (error) {
        console.error('Sitemap Error:', error);

        if (res.statusCode) res.statusCode = 500;
        if (typeof res.status === 'function') res.status(500);

        if (typeof res.end === 'function') res.end('Error generating sitemap');
        else if (typeof res.send === 'function') res.send('Error generating sitemap');
    }
};
