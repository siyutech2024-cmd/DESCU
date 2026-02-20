import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function escapeXml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

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

        // Fetch active products with images and titles for rich sitemap
        const { data: products } = await supabase
            .from('products')
            .select('id, updated_at, images, title, title_es, title_en, title_zh')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5000);

        // Generate XML with image and hreflang support
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="es-MX" href="${baseUrl}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/?lang=en" />
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/?lang=zh" />
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

        // Product pages with hreflang + image tags
        if (products) {
            for (const p of products) {
                const lastmod = p.updated_at
                    ? new Date(p.updated_at).toISOString().split('T')[0]
                    : today;
                const productUrl = `${baseUrl}/product/${p.id}`;
                const images = p.images || [];
                const title = p.title_es || p.title_en || p.title || '';

                xml += `
  <url>
    <loc>${productUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="es-MX" href="${productUrl}" />
    <xhtml:link rel="alternate" hreflang="en" href="${productUrl}?lang=en" />
    <xhtml:link rel="alternate" hreflang="zh" href="${productUrl}?lang=zh" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${productUrl}" />`;

                // Add first image for Google Image search indexing
                if (images.length > 0) {
                    xml += `
    <image:image>
      <image:loc>${escapeXml(images[0])}</image:loc>
      ${title ? `<image:title>${escapeXml(title)}</image:title>` : ''}
    </image:image>`;
                }

                xml += `
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
