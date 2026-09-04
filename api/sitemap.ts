import { createClient } from '@supabase/supabase-js';
import { CANONICAL_CATEGORIES, normalizeCategory, type CanonicalCategory } from './_lib/domain/categories.js';
import { ALL_MEXICO_SLUG, SEO_CITIES, productInCity } from './_lib/seo/cities.js';
import { BASE_URL, HOW_IT_WORKS_PATH, categorySlug } from './_lib/seo/site.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * sitemap.xml — static pages, the category × city landing pages that actually have listings
 * (empty combinations are `noindex` in the prerender, so they are not announced here) and
 * every active product with its first image and language alternates.
 *
 * lastmod is derived from the data (newest matching product) instead of "today", so crawlers
 * can tell what really changed.
 */

/** Last time the static copy of these pages changed — bump when editing the SPA pages / prerender templates. */
const STATIC_LASTMOD = '2026-09-04';

function escapeXml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const day = (iso: string | null | undefined, fallback: string) => (iso ? new Date(iso).toISOString().split('T')[0] : fallback);

const alternates = (path: string) => `
    <xhtml:link rel="alternate" hreflang="es-MX" href="${BASE_URL}${path}" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}${path}?lang=en" />
    <xhtml:link rel="alternate" hreflang="zh" href="${BASE_URL}${path}?lang=zh" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${path}" />`;

const urlEntry = (path: string, lastmod: string, changefreq: string, priority: string, extra = '') => `
  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${extra}
  </url>`;

interface Row {
    id: string; created_at: string | null; updated_at: string | null; images: string[] | null;
    title: string | null; title_es: string | null; title_en: string | null;
    category: string | null; city: string | null; town: string | null; location_display_name: string | null;
}

export default async function handler(req: any, res: any) {
    try {
        if (!supabaseUrl || !supabaseKey) throw new Error('Supabase not configured');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('products')
            .select('id, created_at, updated_at, images, title, title_es, title_en, category, city, town, location_display_name')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5000);
        if (error) throw error;
        const products = (data || []) as Row[];
        const newest = day(products[0]?.created_at, today);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

        xml += urlEntry('/', newest, 'daily', '1.0', alternates('/'));
        xml += urlEntry(HOW_IT_WORKS_PATH, STATIC_LASTMOD, 'monthly', '0.8', alternates(HOW_IT_WORKS_PATH));
        xml += urlEntry('/privacy-policy', STATIC_LASTMOD, 'yearly', '0.2');

        // Landing pages: category × (all Mexico + cities), only where there is at least one listing.
        const byCategory = new Map<CanonicalCategory, Row[]>();
        for (const p of products) {
            const c = normalizeCategory(p.category);
            const list = byCategory.get(c) ?? [];
            list.push(p);
            byCategory.set(c, list);
        }
        const landing = (path: string, rows: Row[], priority: string) => {
            if (rows.length === 0) return;
            xml += urlEntry(path, day(rows[0].created_at, today), 'daily', priority, alternates(path));
        };
        for (const category of CANONICAL_CATEGORIES) {
            const rows = byCategory.get(category) ?? [];
            landing(`/buy/${categorySlug(category)}/in/${ALL_MEXICO_SLUG}`, rows, '0.8');
            for (const city of SEO_CITIES) {
                landing(`/buy/${categorySlug(category)}/in/${city.slug}`, rows.filter(p => productInCity(city, p)), '0.6');
            }
        }
        for (const city of SEO_CITIES) {
            landing(`/buy/all/in/${city.slug}`, products.filter(p => productInCity(city, p)), '0.7');
        }

        // Products
        for (const p of products) {
            const path = `/product/${p.id}`;
            const image = p.images?.[0];
            const title = p.title_es || p.title_en || p.title || '';
            const imageXml = image ? `
    <image:image>
      <image:loc>${escapeXml(image)}</image:loc>${title ? `
      <image:title>${escapeXml(title)}</image:title>` : ''}
    </image:image>` : '';
            xml += urlEntry(path, day(p.updated_at || p.created_at, today), 'weekly', '0.9', alternates(path) + imageXml);
        }

        xml += `
</urlset>`;

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
        res.status(200).send(xml);
    } catch (error: any) {
        console.error('Sitemap Error:', error);
        res.status(500).send('Error generating sitemap');
    }
}
