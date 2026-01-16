
import { Request, Response } from 'express';
import { supabase } from '../db/supabase';

export const generateSitemap = async (req: Request, res: Response) => {
    try {
        // 1. Fetch Static Routes (Hardcoded)
        // Use request host to determine domain
        const protocol = req.protocol === 'http' && req.get('host')?.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${req.get('host')}`;

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

        res.header('Content-Type', 'application/xml');
        res.send(xml);

    } catch (error) {
        console.error('Sitemap Error:', error);
        res.status(500).send('Error generating sitemap');
    }
};
