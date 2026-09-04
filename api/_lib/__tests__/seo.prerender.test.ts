process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';

import { resetDb, type Row } from './helpers/fakeSupabase';

// api/prerender.ts and api/sitemap.ts create their own client; hand them the in-memory fake.
jest.mock('@supabase/supabase-js', () => ({ createClient: () => require('./helpers/fakeSupabase').fakeSupabase }));

import prerender from '../../prerender';
import sitemap from '../../sitemap';
import { SEO_CITIES, findCity, productInCity } from '../seo/cities';
import { categoryFromSlug, categoryLabel, howItWorksContent, SITE_FACTS } from '../seo/site';

const product = (o: Partial<Row>): Row => ({
    id: 'p-1', title: 'iPhone 12', title_es: 'iPhone 12', price: 5000, currency: 'MXN', images: ['https://img/1.jpg'],
    category: 'Electronics', status: 'active', deleted_at: null, city: 'Ciudad de México', town: 'Coyoacán',
    location_display_name: 'Coyoacán, Ciudad de México', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-02T00:00:00Z',
    description: 'Como nuevo <script>alert(1)</script>', condition: 'used', seller_name: 'Ana', ...o,
});

const seed = () => resetDb({
    products: [
        product({ id: 'cdmx-1' }),
        product({ id: 'cdmx-2', category: 'electronics', city: 'Tlalnepantla', town: null, location_display_name: 'Tlalnepantla de Baz, México', created_at: '2026-08-03T00:00:00Z' }),
        product({ id: 'gdl-1', category: 'Furniture', city: 'Zapopan', town: null, location_display_name: 'Zapopan, Jalisco' }),
        product({ id: 'sold-1', status: 'sold' }),
        product({ id: 'gone-1', deleted_at: '2026-08-05T00:00:00Z' }),
        product({ id: 'pending-1', status: 'pending_review' }),
    ],
});

const run = async (path: string, lang?: string) => {
    const headers: Record<string, string> = {};
    let status = 200;
    let body = '';
    const res = {
        setHeader: (k: string, v: string) => { headers[k] = v; },
        status: (s: number) => { status = s; return res; },
        send: (b: string) => { body = b; return res; },
    };
    await prerender({ query: { path, ...(lang ? { lang } : {}) } }, res);
    return { status, body, headers };
};

const jsonLdOf = (html: string) => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    return JSON.parse(m![1]);
};

beforeEach(seed);

describe('city matching', () => {
    const cdmx = findCity('ciudad-de-mexico')!;
    it('matches accented and metro-area spellings', () => {
        expect(productInCity(cdmx, { city: 'Ciudad de México' })).toBe(true);
        expect(productInCity(cdmx, { city: 'Mexico City' })).toBe(true);
        expect(productInCity(cdmx, { city: 'CDMX' })).toBe(true);
        expect(productInCity(cdmx, { city: 'Tlalnepantla' })).toBe(true);
        expect(productInCity(cdmx, { city: null, town: null, location_display_name: 'Polanco, Miguel Hidalgo' })).toBe(true);
        expect(productInCity(cdmx, { city: 'Guadalajara' })).toBe(false);
        expect(productInCity(cdmx, {})).toBe(false);
    });
    it('does not let "León" swallow "Nuevo León"', () => {
        const leon = findCity('leon')!;
        expect(productInCity(leon, { city: 'Monterrey', location_display_name: 'Monterrey, Nuevo León' })).toBe(false);
        expect(productInCity(leon, { city: 'León', location_display_name: 'León, Guanajuato' })).toBe(true);
    });
    it('every city slug is unique and lowercase', () => {
        const slugs = SEO_CITIES.map(c => c.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        expect(slugs.every(s => /^[a-z-]+$/.test(s))).toBe(true);
    });
});

describe('category slugs and labels', () => {
    it('resolves canonical, alias and unknown slugs', () => {
        expect(categoryFromSlug('electronics')).toBe('Electronics');
        expect(categoryFromSlug('realestate')).toBe('RealEstate');
        expect(categoryFromSlug('real_estate')).toBe('RealEstate');
        expect(categoryFromSlug('autos')).toBe('Vehicles');
        expect(categoryFromSlug('other')).toBe('Other');
        expect(categoryFromSlug('all')).toBeNull();
        expect(categoryFromSlug('gadgets')).toBeNull();
    });
    it('localizes labels from any stored spelling', () => {
        expect(categoryLabel('electronics', 'es')).toBe('Electrónica');
        expect(categoryLabel('Health & Beauty > Fragrances', 'en')).toBe('Clothing & Fashion');
        expect(categoryLabel(null, 'zh')).toBe('其他');
    });
    it('how-it-works copy carries the real fee and shipping numbers', () => {
        for (const lang of ['es', 'en', 'zh'] as const) {
            const c = howItWorksContent(lang);
            const all = JSON.stringify(c);
            expect(all).toContain(`${SITE_FACTS.platformFeePercent}%`);
            expect(all).toContain(String(SITE_FACTS.shippingFeeMxn));
            expect(c.faq.length).toBeGreaterThanOrEqual(8);
        }
    });
});

describe('prerender', () => {
    it('homepage lists active products only, with WebSite + ItemList schema', async () => {
        const { status, body } = await run('/');
        expect(status).toBe(200);
        const graph = jsonLdOf(body)['@graph'];
        const list = graph.find((n: any) => n['@type'] === 'ItemList');
        expect(list.numberOfItems).toBe(3);
        expect(body).toContain('/buy/electronics/in/mexico');
        expect(body).toContain('/buy/all/in/guadalajara');
        expect(body).toContain('/como-funciona');
        expect(body).not.toContain('aggregateRating');
    });

    it('landing page filters by category alias and city spelling', async () => {
        const { status, body } = await run('/buy/electronics/in/ciudad-de-mexico');
        expect(status).toBe(200);
        expect(body).toContain('cdmx-1');
        expect(body).toContain('cdmx-2'); // lowercase category + metro-area city
        expect(body).not.toContain('gdl-1');
        expect(body).not.toContain('sold-1');
        expect(body).toContain('Electrónica de segunda mano en Ciudad de México');
        expect(body).toContain('<meta name="robots" content="index, follow');
        expect(body).toContain('hreflang="en" href="https://descu.ai/buy/electronics/in/ciudad-de-mexico?lang=en"');
        const crumbs = jsonLdOf(body)['@graph'].find((n: any) => n['@type'] === 'BreadcrumbList');
        expect(crumbs.itemListElement[1].item).toBe('https://descu.ai/buy/electronics/in/mexico');
    });

    it('empty landing pages are noindex,follow; unknown slugs are 404', async () => {
        const empty = await run('/buy/books/in/merida');
        expect(empty.status).toBe(200);
        expect(empty.body).toContain('content="noindex, follow"');
        expect(empty.body).not.toContain('hreflang=');
        expect((await run('/buy/gadgets/in/mexico')).status).toBe(404);
        expect((await run('/buy/electronics/in/atlantis')).status).toBe(404);
    });

    it('country-wide and all-category pages work and are localized', async () => {
        const all = await run('/buy/all/in/guadalajara', 'en');
        expect(all.status).toBe(200);
        expect(all.body).toContain('gdl-1');
        expect(all.body).toContain('<html lang="en">');
        expect(all.body).toContain('<link rel="canonical" href="https://descu.ai/buy/all/in/guadalajara?lang=en" />');
        const mx = await run('/buy/furniture/in/mexico', 'zh');
        expect(mx.body).toContain('gdl-1');
        expect(mx.body).toContain('二手家居家具');
    });

    it('product page: escaped content, Product/Offer schema without a fake brand, related items', async () => {
        const { status, body } = await run('/product/cdmx-1');
        expect(status).toBe(200);
        expect(body).not.toContain('<script>alert(1)</script>');
        expect(body).toContain('&lt;script&gt;');
        const graph = jsonLdOf(body)['@graph'];
        const prod = graph.find((n: any) => n['@type'] === 'Product');
        expect(prod.brand).toBeUndefined();
        expect(prod.offers.price).toBe(5000);
        expect(prod.offers.availability).toBe('https://schema.org/InStock');
        expect(prod.offers.seller.name).toBe('Ana');
        expect(graph.find((n: any) => n['@type'] === 'FAQPage').mainEntity).toHaveLength(3);
        expect(body).toContain('cdmx-2'); // related: same category
        expect(body).not.toContain('og:image:width');
        expect(body).toContain('<link rel="canonical" href="https://descu.ai/product/cdmx-1" />');
    });

    it('sold products stay indexable as SoldOut; unreviewed ones are noindex; deleted are 404', async () => {
        const sold = await run('/product/sold-1');
        expect(sold.status).toBe(200);
        expect(sold.body).toContain('https://schema.org/SoldOut');
        expect(sold.body).toContain('content="index, follow');
        const pending = await run('/product/pending-1');
        expect(pending.body).toContain('content="noindex, follow"');
        expect((await run('/product/gone-1')).status).toBe(404);
        expect((await run('/product/nope')).status).toBe(404);
        expect((await run('/whatever')).status).toBe(404);
    });

    it('how-it-works page carries HowTo + FAQPage schema in the requested language', async () => {
        const { status, body } = await run('/como-funciona', 'en');
        expect(status).toBe(200);
        const graph = jsonLdOf(body)['@graph'];
        expect(graph.filter((n: any) => n['@type'] === 'HowTo')).toHaveLength(2);
        const faq = graph.find((n: any) => n['@type'] === 'FAQPage');
        expect(faq.mainEntity[0].name).toBe('How much does it cost to list on DESCU?');
        expect(body).toContain(`${SITE_FACTS.platformFeePercent}% service fee`);
    });
});

describe('sitemap', () => {
    it('lists static pages, non-empty landing pages and active products with real lastmod', async () => {
        let body = '';
        const res = { setHeader: () => undefined, status: () => res, send: (b: string) => { body = b; return res; } };
        await sitemap({}, res);
        expect(body).toContain('<loc>https://descu.ai/como-funciona</loc>');
        expect(body).toContain('<loc>https://descu.ai/buy/electronics/in/ciudad-de-mexico</loc>');
        expect(body).toContain('<loc>https://descu.ai/buy/furniture/in/guadalajara</loc>');
        expect(body).toContain('<loc>https://descu.ai/buy/all/in/guadalajara</loc>');
        expect(body).not.toContain('/buy/books/in/');            // no listings → not announced
        expect(body).not.toContain('/?category=');               // old duplicate URLs gone
        expect(body).toContain('<loc>https://descu.ai/product/cdmx-1</loc>');
        expect(body).not.toContain('sold-1');
        expect(body).not.toContain('gone-1');
        expect(body).toContain('<lastmod>2026-08-02</lastmod>'); // product updated_at
        expect(body).toContain('<image:loc>https://img/1.jpg</image:loc>');
    });
});
