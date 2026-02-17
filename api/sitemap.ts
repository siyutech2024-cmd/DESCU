import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: any, res: any) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const baseUrl = 'https://descu.ai';
        const today = new Date().toISOString().split('T')[0];

        const categories = [
            'Electronics', 'Vehicles', 'RealEstate', 'Furniture',
            'Clothing', 'Sports', 'Books', 'Services', 'Other'
        ];

        // Fetch active products
        const { data: products } = await supabase
            .from('products')
            .select('id, updated_at')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(2000);

        // Generate XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="es-MX" href="${baseUrl}/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/" />
  </url>
  <url>
    <loc>${baseUrl}/privacy-policy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

        // Category pages
        for (const cat of categories) {
            xml += `
  <url>
    <loc>${baseUrl}/?category=${cat}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
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

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        res.status(200).send(xml);
    } catch (error: any) {
        console.error('Sitemap Error:', error);
        res.status(500).send('Error generating sitemap');
    }
}
