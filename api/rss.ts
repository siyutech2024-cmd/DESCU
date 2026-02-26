import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function escapeXml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * RSS 2.0 Feed — Latest products from DESCU marketplace.
 * Enables discovery via RSS aggregators (Feedly, Google News, etc.)
 * and creates natural backlinks to product pages.
 * 
 * Accessible at: https://descu.ai/rss.xml
 */
export default async function handler(req: any, res: any) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const baseUrl = 'https://descu.ai';

        const { data: products, error } = await supabase
            .from('products')
            .select('id, title, title_es, title_en, description, description_es, description_en, price, currency, category, city, town, images, created_at, updated_at')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        const now = new Date().toUTCString();
        const lastBuildDate = products?.[0]?.created_at
            ? new Date(products[0].created_at).toUTCString()
            : now;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>DESCU - Marketplace de Segunda Mano con IA</title>
    <link>${baseUrl}</link>
    <description>Los artículos más recientes en DESCU, el marketplace de segunda mano con inteligencia artificial en México. Electrónicos, autos, muebles, ropa y más.</description>
    <language>es-mx</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${baseUrl}/logo-512.png</url>
      <title>DESCU</title>
      <link>${baseUrl}</link>
    </image>
    <category>Shopping</category>
    <category>Marketplace</category>
    <category>Secondhand</category>
    <generator>DESCU RSS Generator</generator>`;

        if (products) {
            for (const p of products) {
                const title = p.title_es || p.title_en || p.title || 'Producto en DESCU';
                const desc = p.description_es || p.description_en || p.description || '';
                const price = p.price || 0;
                const currency = p.currency || 'MXN';
                const priceStr = currency === 'MXN'
                    ? `$${price.toLocaleString('es-MX')} MXN`
                    : `$${price.toLocaleString('en-US')} ${currency}`;
                const city = p.city || p.town || 'México';
                const category = p.category || 'Other';
                const productUrl = `${baseUrl}/product/${p.id}`;
                const image = p.images?.[0] || '';
                const pubDate = p.created_at
                    ? new Date(p.created_at).toUTCString()
                    : now;

                const itemDesc = `${priceStr} — ${desc.substring(0, 300)}${desc.length > 300 ? '...' : ''} | ${city}, México`;

                xml += `
    <item>
      <title>${escapeXml(title)} | ${escapeXml(priceStr)}</title>
      <link>${productUrl}</link>
      <guid isPermaLink="true">${productUrl}</guid>
      <description>${escapeXml(itemDesc)}</description>
      <category>${escapeXml(category)}</category>
      <pubDate>${pubDate}</pubDate>
      ${image ? `<media:content url="${escapeXml(image)}" medium="image" />
      <enclosure url="${escapeXml(image)}" type="image/jpeg" />` : ''}
    </item>`;
            }
        }

        xml += `
  </channel>
</rss>`;

        res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');
        res.status(200).send(xml);
    } catch (error: any) {
        console.error('[RSS] Error:', error);
        res.status(500).send('Error generating RSS feed');
    }
}
