import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CANONICAL_CATEGORIES, categoryVariants, normalizeCategory, type CanonicalCategory } from './_lib/domain/categories.js';
import { ALL_MEXICO_SLUG, SEO_CITIES, findCity, productInCity, type SeoCity } from './_lib/seo/cities.js';
import {
    BASE_URL, HOW_IT_WORKS_PATH, OG_IMAGE, SITE_FACTS, SITE_TEXT, categoryFromSlug, categoryLabel, categorySlug,
    howItWorksContent, htmlLangFor, landingPath, ogLocaleFor, parseSeoLang, type SeoLang,
} from './_lib/seo/site.js';

/**
 * Bot-facing HTML for the SPA routes (vercel.json rewrites crawler user agents here).
 *
 *   /                          homepage: intro, categories, cities, latest items (ItemList)
 *   /como-funciona             how it works: HowTo ×2 + FAQPage
 *   /buy/{category}/in/{city}  programmatic landing page (CollectionPage + ItemList)
 *   /product/{id}              product page (Product/Offer + FAQ + related items)
 *
 * `?lang=es|en|zh` selects the language (the SPA honours the same parameter, so the
 * hreflang alternates point at real pages). Everything else is Spanish, the market language.
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const LISTING_COLUMNS = 'id, title, title_es, title_en, title_zh, price, currency, images, category, subcategory, city, town, location_display_name, created_at, updated_at';

interface Listing {
    id: string;
    title?: string | null; title_es?: string | null; title_en?: string | null; title_zh?: string | null;
    description?: string | null; description_es?: string | null; description_en?: string | null; description_zh?: string | null;
    price?: number | null; currency?: string | null; images?: string[] | null;
    category?: string | null; subcategory?: string | null;
    city?: string | null; town?: string | null; district?: string | null; location_display_name?: string | null;
    latitude?: number | null; longitude?: number | null;
    created_at?: string | null; updated_at?: string | null;
    status?: string | null; deleted_at?: string | null; condition?: string | null; delivery_type?: string | null;
    seller_name?: string | null;
}

// ---------- helpers ----------

function localized(p: Listing, field: 'title' | 'description', lang: SeoLang): string {
    const row = p as unknown as Record<string, string | null | undefined>;
    return row[`${field}_${lang}`] || row[`${field}_es`] || row[field] || row[`${field}_en`] || row[`${field}_zh`] || '';
}

function escapeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** JSON-LD must not be able to close its own <script>. */
const jsonLd = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c');

function formatPrice(price: number, currency = 'MXN'): string {
    if (currency === 'MXN') return `$${price.toLocaleString('es-MX')} MXN`;
    return `$${price.toLocaleString('en-US')} ${currency}`;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const cityName = (city: SeoCity, lang: SeoLang) => (lang === 'en' ? city.nameEn : lang === 'zh' ? city.nameZh : city.name);
const countryName = (lang: SeoLang) => (lang === 'en' ? 'Mexico' : lang === 'zh' ? '墨西哥' : 'México');
const productCity = (p: Listing) => p.city || p.town || '';

const withLang = (path: string, lang: SeoLang) => `${BASE_URL}${path}${lang === 'es' ? '' : `${path.includes('?') ? '&' : '?'}lang=${lang}`}`;

const UI: Record<SeoLang, Record<string, string>> = {
    es: {
        home: 'Inicio', browse: 'Artículos recientes', categories: 'Categorías', cities: 'Ciudades', howItWorks: 'Cómo funciona',
        category: 'Categoría', seller: 'Vendedor', condition: 'Condición', new: 'Nuevo', used: 'Usado', desc: 'Descripción',
        location: 'Ubicación', payment: 'Pago', paymentDesc: 'Tarjeta, OXXO o SPEI con custodia (Stripe), o efectivo al entregar',
        faq: 'Preguntas frecuentes', related: 'Artículos similares', moreIn: 'Más en', otherCities: 'en otras ciudades', otherCategories: 'Otras categorías en',
        sold: 'Vendido', unavailable: 'No disponible', allItems: 'Todo', inAllMexico: 'en todo México', items: 'artículos', publishedOn: 'Publicado el', privacy: 'Privacidad',
        noItems: 'Por ahora no hay artículos publicados aquí. Sé el primero en vender o explora otras ciudades.', viewAll: 'Ver todos los artículos', download: 'Descargar en Google Play',
    },
    en: {
        home: 'Home', browse: 'Latest items', categories: 'Categories', cities: 'Cities', howItWorks: 'How it works',
        category: 'Category', seller: 'Seller', condition: 'Condition', new: 'New', used: 'Used', desc: 'Description',
        location: 'Location', payment: 'Payment', paymentDesc: 'Card, OXXO or SPEI held in escrow (Stripe), or cash at handoff',
        faq: 'Frequently asked questions', related: 'Similar items', moreIn: 'More in', otherCities: 'in other cities', otherCategories: 'Other categories in',
        sold: 'Sold', unavailable: 'Unavailable', allItems: 'All items', inAllMexico: 'across Mexico', items: 'items', publishedOn: 'Listed on', privacy: 'Privacy',
        noItems: 'Nothing listed here yet. Be the first to sell, or browse other cities.', viewAll: 'Browse all items', download: 'Get it on Google Play',
    },
    zh: {
        home: '首页', browse: '最新商品', categories: '分类', cities: '城市', howItWorks: '使用指南',
        category: '分类', seller: '卖家', condition: '成色', new: '全新', used: '二手', desc: '商品描述',
        location: '位置', payment: '支付', paymentDesc: '银行卡、OXXO 或 SPEI 担保支付（Stripe），或当面付现',
        faq: '常见问题', related: '相似商品', moreIn: '更多', otherCities: '其他城市', otherCategories: '该城市的其他分类',
        sold: '已售出', unavailable: '暂不可用', allItems: '全部商品', inAllMexico: '全墨西哥', items: '件商品', publishedOn: '发布于', privacy: '隐私政策',
        noItems: '这里暂时还没有商品。成为第一个卖家，或浏览其他城市。', viewAll: '浏览全部商品', download: '在 Google Play 下载',
    },
};

// ---------- page shell ----------

interface Page {
    lang: SeoLang;
    path: string;                 // canonical path (no query)
    title: string;
    description: string;
    robots?: string;              // default index,follow
    ogType?: string;
    ogImage?: string;
    extraHead?: string;
    schema: unknown;              // JSON-LD @graph root
    body: string;                 // <main> content
    breadcrumbs?: { name: string; path: string }[];
}

function shell(p: Page): string {
    const lang = p.lang;
    const ui = UI[lang];
    const canonical = withLang(p.path, lang);
    const indexable = !p.robots || p.robots.startsWith('index');
    const alternates = indexable ? `
    <link rel="alternate" hreflang="es-MX" href="${BASE_URL}${p.path}" />
    <link rel="alternate" hreflang="en" href="${withLang(p.path, 'en')}" />
    <link rel="alternate" hreflang="zh" href="${withLang(p.path, 'zh')}" />
    <link rel="alternate" hreflang="x-default" href="${BASE_URL}${p.path}" />` : '';
    const crumbs = p.breadcrumbs && p.breadcrumbs.length > 0
        ? `<nav aria-label="breadcrumb" class="crumbs">${p.breadcrumbs.map((c, i) =>
            i === p.breadcrumbs!.length - 1
                ? `<span aria-current="page">${escapeHtml(c.name)}</span>`
                : `<a href="${withLang(c.path, lang)}">${escapeHtml(c.name)}</a>`).join(' › ')}</nav>`
        : '';

    return `<!DOCTYPE html>
<html lang="${htmlLangFor(lang)}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(p.title)}</title>
    <meta name="description" content="${escapeHtml(p.description)}" />
    <meta name="robots" content="${p.robots || 'index, follow, max-image-preview:large'}" />
    <link rel="canonical" href="${canonical}" />${alternates}
    <link rel="alternate" type="application/rss+xml" title="DESCU" href="${BASE_URL}/rss.xml" />
    <meta name="geo.region" content="MX" />
    <meta property="og:type" content="${p.ogType || 'website'}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(p.title)}" />
    <meta property="og:description" content="${escapeHtml(p.description)}" />
    <meta property="og:image" content="${escapeHtml(p.ogImage || OG_IMAGE)}" />
    <meta property="og:site_name" content="DESCU" />
    <meta property="og:locale" content="${ogLocaleFor(lang)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(p.title)}" />
    <meta name="twitter:description" content="${escapeHtml(p.description)}" />
    <meta name="twitter:image" content="${escapeHtml(p.ogImage || OG_IMAGE)}" />
    ${p.extraHead || ''}
    <script type="application/ld+json">${jsonLd(p.schema)}</script>
    <style>
        body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;line-height:1.55;background:#fff}
        header,footer{text-align:center;padding:20px 16px}
        header a.logo{font-size:26px;font-weight:800;color:#ec4899;text-decoration:none;letter-spacing:-.02em}
        header nav a{margin:0 8px;color:#4b5563;text-decoration:none;font-size:14px}
        main{max-width:860px;margin:0 auto;padding:0 16px 32px}
        .crumbs{font-size:14px;color:#6b7280;margin:8px 0 16px}.crumbs a{color:#6b7280}
        h1{font-size:26px;line-height:1.2;margin:8px 0 12px}h2{font-size:19px;margin:28px 0 12px}h3{font-size:16px;margin:16px 0 4px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;padding:0;list-style:none;margin:0}
        .card{border:1px solid #eee;border-radius:12px;overflow:hidden}.card img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
        .card .b{padding:10px}.card .t{font-size:15px;margin:0 0 4px}.card .t a{color:#111;text-decoration:none}.card .p{font-weight:700;color:#ec4899;margin:0}.card .m{font-size:12px;color:#6b7280;margin:2px 0 0}
        .chips{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none;margin:0}.chips a{display:inline-block;padding:6px 12px;border:1px solid #e5e7eb;border-radius:999px;color:#374151;text-decoration:none;font-size:14px}
        .price{font-size:30px;font-weight:800;color:#ec4899;margin:4px 0 12px}dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0 0 16px}dt{color:#6b7280}dd{margin:0}
        .hero img{width:100%;max-height:520px;object-fit:cover;border-radius:12px}
        .faq h3{margin-top:18px}.muted{color:#6b7280}footer{color:#9ca3af;font-size:13px}footer a{color:#9ca3af;margin:0 6px}
        ol.steps{padding-left:22px}ol.steps li{margin:8px 0}
    </style>
</head>
<body>
    <header>
        <a class="logo" href="${withLang('/', lang)}">DESCU</a>
        <p class="muted" style="margin:4px 0 10px">${escapeHtml(SITE_TEXT[lang].tagline)}</p>
        <nav>
            <a href="${withLang('/', lang)}">${ui.home}</a>
            <a href="${withLang(HOW_IT_WORKS_PATH, lang)}">${ui.howItWorks}</a>
            ${CANONICAL_CATEGORIES.filter(c => c !== 'Other').map(c => `<a href="${withLang(landingPath(c, ALL_MEXICO_SLUG), lang)}">${escapeHtml(categoryLabel(c, lang))}</a>`).join('')}
        </nav>
    </header>
    <main>
        ${crumbs}
        ${p.body}
    </main>
    <footer>
        <p>&copy; ${new Date().getFullYear()} DESCU · ${escapeHtml(SITE_TEXT[lang].tagline)}</p>
        <p><a href="${withLang(HOW_IT_WORKS_PATH, lang)}">${ui.howItWorks}</a> · <a href="${BASE_URL}/privacy-policy">${ui.privacy}</a> · <a href="https://play.google.com/store/apps/details?id=com.venya.marketplace" rel="noopener">${ui.download}</a></p>
    </footer>
</body>
</html>`;
}

// ---------- shared fragments ----------

function listingCard(p: Listing, lang: SeoLang): string {
    const title = localized(p, 'title', lang) || 'Producto';
    const image = p.images?.[0];
    const city = productCity(p);
    return `<li class="card">
        ${image ? `<a href="${withLang(`/product/${p.id}`, lang)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" width="400" height="400" /></a>` : ''}
        <div class="b">
            <h3 class="t"><a href="${withLang(`/product/${p.id}`, lang)}">${escapeHtml(title)}</a></h3>
            <p class="p">${formatPrice(Number(p.price) || 0, p.currency || 'MXN')}</p>
            <p class="m">${escapeHtml(categoryLabel(p.category, lang))}${city ? ` · ${escapeHtml(city)}` : ''}</p>
        </div>
    </li>`;
}

const listingGrid = (items: Listing[], lang: SeoLang) => `<ul class="grid">${items.map(p => listingCard(p, lang)).join('\n')}</ul>`;

function itemList(name: string, items: Listing[], lang: SeoLang) {
    return {
        '@type': 'ItemList',
        name,
        numberOfItems: items.length,
        itemListElement: items.map((p, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: `${BASE_URL}/product/${p.id}`,
            name: localized(p, 'title', lang) || 'Producto',
            image: p.images?.[0] || OG_IMAGE,
        })),
    };
}

const breadcrumbSchema = (crumbs: { name: string; path: string }[]) => ({
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${BASE_URL}${c.path}` })),
});

const websiteSchema = (lang: SeoLang) => ({
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'DESCU',
    url: `${BASE_URL}/`,
    inLanguage: htmlLangFor(lang),
    description: SITE_TEXT[lang].shortDesc,
    publisher: { '@id': `${BASE_URL}/#organization` },
    potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/?search={search_term_string}` },
        'query-input': 'required name=search_term_string',
    },
});

const organizationSchema = () => ({
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'DESCU',
    url: `${BASE_URL}/`,
    logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo-512.png`, width: 512, height: 512 },
    sameAs: [
        'https://www.facebook.com/profile.php?id=61572770731498',
        'https://www.instagram.com/descumarketplace',
        'https://x.com/descumarketplace',
        'https://play.google.com/store/apps/details?id=com.venya.marketplace',
    ],
    areaServed: { '@type': 'Country', name: 'Mexico' },
    knowsLanguage: ['es', 'en', 'zh'],
});

const categoryChips = (lang: SeoLang, citySlug: string, except?: CanonicalCategory | null) =>
    `<ul class="chips">${CANONICAL_CATEGORIES.filter(c => c !== except).map(c =>
        `<li><a href="${withLang(landingPath(c, citySlug), lang)}">${escapeHtml(categoryLabel(c, lang))}</a></li>`).join('')}</ul>`;

const cityChips = (lang: SeoLang, category: CanonicalCategory | null, except?: string) => {
    const seg = category ? categorySlug(category) : 'all';
    const all = except === ALL_MEXICO_SLUG ? '' : `<li><a href="${withLang(`/buy/${seg}/in/${ALL_MEXICO_SLUG}`, lang)}">${escapeHtml(countryName(lang))}</a></li>`;
    return `<ul class="chips">${all}${SEO_CITIES.filter(c => c.slug !== except).map(c =>
        `<li><a href="${withLang(`/buy/${seg}/in/${c.slug}`, lang)}">${escapeHtml(cityName(c, lang))}</a></li>`).join('')}</ul>`;
};

// ---------- data ----------

async function fetchActive(supabase: SupabaseClient, opts: { category?: CanonicalCategory | null; limit: number; exclude?: string }): Promise<Listing[]> {
    let q = supabase.from('products').select(LISTING_COLUMNS).eq('status', 'active').is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(opts.limit);
    if (opts.category) q = q.in('category', categoryVariants(opts.category));
    if (opts.exclude) q = q.neq('id', opts.exclude);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as Listing[];
}

// ---------- pages ----------

function homePage(products: Listing[], lang: SeoLang): string {
    const ui = UI[lang];
    const text = SITE_TEXT[lang];
    const how = howItWorksContent(lang);
    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            organizationSchema(),
            websiteSchema(lang),
            { '@type': 'WebPage', '@id': `${BASE_URL}/`, url: `${BASE_URL}/`, name: text.homeTitle, description: text.homeDesc, inLanguage: htmlLangFor(lang), isPartOf: { '@id': `${BASE_URL}/#website` } },
            itemList(ui.browse, products, lang),
        ],
    };
    const h1: Record<SeoLang, string> = {
        es: 'Compra y vende segunda mano cerca de ti, con IA',
        en: 'Buy and sell secondhand near you, with AI',
        zh: '用 AI 就近买卖二手',
    };
    const body = `
        <h1>${escapeHtml(h1[lang])}</h1>
        <p>${escapeHtml(text.shortDesc)} <a href="${withLang(HOW_IT_WORKS_PATH, lang)}">${escapeHtml(ui.howItWorks)} →</a></p>
        <h2>${ui.categories}</h2>
        ${categoryChips(lang, ALL_MEXICO_SLUG)}
        <h2>${ui.cities}</h2>
        ${cityChips(lang, null, ALL_MEXICO_SLUG)}
        <h2>${ui.browse} (${products.length})</h2>
        ${listingGrid(products, lang)}
        <h2>${escapeHtml(how.sellHeading)}</h2>
        <ol class="steps">${how.sellSteps.map(s => `<li><strong>${escapeHtml(s.name)}.</strong> ${escapeHtml(s.text)}</li>`).join('')}</ol>
        <p><a href="${withLang(HOW_IT_WORKS_PATH, lang)}">${escapeHtml(how.title)} →</a></p>`;
    return shell({ lang, path: '/', title: text.homeTitle, description: text.homeDesc, schema, body, extraHead: '<meta name="geo.placename" content="México" />' });
}

function howItWorksPage(lang: SeoLang): string {
    const ui = UI[lang];
    const how = howItWorksContent(lang);
    const url = `${BASE_URL}${HOW_IT_WORKS_PATH}`;
    const howTo = (name: string, steps: { name: string; text: string }[]) => ({
        '@type': 'HowTo',
        name,
        inLanguage: htmlLangFor(lang),
        totalTime: 'PT2M',
        tool: { '@type': 'HowToTool', name: 'DESCU (descu.ai / Android app)' },
        step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text, url: `${url}#${i < 4 ? 'sell' : 'buy'}-${i + 1}` })),
    });
    const crumbs = [{ name: ui.home, path: '/' }, { name: how.title, path: HOW_IT_WORKS_PATH }];
    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            organizationSchema(),
            { '@type': 'WebPage', '@id': url, url, name: how.metaTitle, description: how.metaDesc, inLanguage: htmlLangFor(lang), isPartOf: { '@id': `${BASE_URL}/#website` } },
            breadcrumbSchema(crumbs),
            howTo(`${how.sellHeading} — DESCU`, how.sellSteps),
            howTo(`${how.buyHeading} — DESCU`, how.buySteps),
            { '@type': 'FAQPage', mainEntity: how.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ],
    };
    const steps = (list: { name: string; text: string }[], prefix: string) =>
        `<ol class="steps">${list.map((s, i) => `<li id="${prefix}-${i + 1}"><strong>${escapeHtml(s.name)}.</strong> ${escapeHtml(s.text)}</li>`).join('')}</ol>`;
    const body = `
        <h1>${escapeHtml(how.title)}</h1>
        <p>${escapeHtml(how.intro)}</p>
        <h2 id="sell">${escapeHtml(how.sellHeading)}</h2>
        ${steps(how.sellSteps, 'sell')}
        <h2 id="buy">${escapeHtml(how.buyHeading)}</h2>
        ${steps(how.buySteps, 'buy')}
        <section class="faq">
            <h2 id="faq">${escapeHtml(how.faqHeading)}</h2>
            ${how.faq.map(f => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}
        </section>
        <h2>${ui.categories}</h2>
        ${categoryChips(lang, ALL_MEXICO_SLUG)}`;
    return shell({ lang, path: HOW_IT_WORKS_PATH, title: how.metaTitle, description: how.metaDesc, schema, body, breadcrumbs: crumbs, ogType: 'article' });
}

function landingPage(products: Listing[], category: CanonicalCategory | null, city: SeoCity | null, lang: SeoLang): string {
    const ui = UI[lang];
    const catLabel = category ? categoryLabel(category, lang) : ui.allItems;
    const place = city ? cityName(city, lang) : countryName(lang);
    const citySlug = city ? city.slug : ALL_MEXICO_SLUG;
    const path = `/buy/${category ? categorySlug(category) : 'all'}/in/${citySlug}`;
    const url = `${BASE_URL}${path}`;

    const titles: Record<SeoLang, string> = {
        es: `${catLabel} de segunda mano en ${place} | DESCU`,
        en: `Used ${catLabel} in ${place}, Mexico | DESCU`,
        zh: `${place}二手${catLabel} | DESCU`,
    };
    const h1s: Record<SeoLang, string> = {
        es: `${catLabel} de segunda mano en ${place}`,
        en: `Used ${catLabel.toLowerCase()} in ${place}`,
        zh: `${place}的二手${catLabel}`,
    };
    const descs: Record<SeoLang, string> = {
        es: `${products.length} ${catLabel.toLowerCase()} de segunda mano en venta en ${place}${city ? `, ${city.state}` : ''}. Compra cerca de ti con pago en custodia (tarjeta, OXXO, SPEI) o en efectivo al entregar. Publica gratis con una foto en DESCU.`,
        en: `${products.length} used ${catLabel.toLowerCase()} for sale in ${place}${city ? `, ${city.state}` : ''}, Mexico. Buy nearby with escrow payment (card, OXXO, SPEI) or cash at handoff. List for free with one photo on DESCU.`,
        zh: `${place}${city ? `（${city.state}）` : ''}共 ${products.length} 件二手${catLabel}在售。就近购买，支持担保支付（银行卡、OXXO、SPEI）或当面付现。在 DESCU 拍照免费发布。`,
    };
    const intro: Record<SeoLang, string> = {
        es: `Anuncios de ${catLabel.toLowerCase()} publicados por personas en ${place}. Cada anuncio muestra precio, fotos y ubicación aproximada; escribe al vendedor por el chat de DESCU para acordar la entrega en persona o el envío ($${SITE_FACTS.shippingFeeMxn} MXN fijos).`,
        en: `${catLabel} listed by people in ${place}. Every listing shows the price, photos and approximate location; message the seller in the DESCU chat to arrange an in-person handoff or shipping (flat MX$${SITE_FACTS.shippingFeeMxn}).`,
        zh: `${place}的用户发布的二手${catLabel}。每个商品都有价格、照片和大致位置；通过 DESCU 聊天联系卖家，约定当面交易或配送（固定 ${SITE_FACTS.shippingFeeMxn} 比索）。`,
    };

    const crumbs = [
        { name: ui.home, path: '/' },
        ...(category ? [{ name: catLabel, path: landingPath(category, ALL_MEXICO_SLUG) }] : []),
        { name: place, path },
    ];
    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            organizationSchema(),
            { '@type': 'CollectionPage', '@id': url, url, name: h1s[lang], description: descs[lang], inLanguage: htmlLangFor(lang), isPartOf: { '@id': `${BASE_URL}/#website` }, ...(city ? { about: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'Country', name: 'Mexico' } } } : {}) },
            breadcrumbSchema(crumbs),
            itemList(h1s[lang], products, lang),
        ],
    };

    const body = `
        <h1>${escapeHtml(h1s[lang])}</h1>
        <p>${escapeHtml(intro[lang])}</p>
        ${products.length > 0
            ? `<p class="muted">${products.length} ${ui.items}</p>${listingGrid(products, lang)}`
            : `<p>${escapeHtml(ui.noItems)} <a href="${withLang('/', lang)}">${escapeHtml(ui.viewAll)}</a></p>`}
        <h2>${escapeHtml(catLabel)} ${escapeHtml(ui.otherCities)}</h2>
        ${cityChips(lang, category, citySlug)}
        <h2>${escapeHtml(ui.otherCategories)} ${escapeHtml(place)}</h2>
        ${categoryChips(lang, citySlug, category)}`;

    // Thin page guard: an empty combination is crawlable (links) but not indexable.
    const robots = products.length === 0 ? 'noindex, follow' : undefined;
    const ogImage = products.find(p => p.images?.[0])?.images?.[0];
    return shell({
        lang, path, title: titles[lang], description: descs[lang], robots, schema, body, breadcrumbs: crumbs, ogImage,
        extraHead: `<meta name="geo.placename" content="${escapeHtml(city ? city.name : 'México')}" />`,
    });
}

function productFaq(p: Listing, lang: SeoLang) {
    const title = localized(p, 'title', lang) || 'Producto';
    const priceStr = formatPrice(Number(p.price) || 0, p.currency || 'MXN');
    const city = productCity(p) || countryName(lang);
    const cat = categoryLabel(p.category, lang).toLowerCase();
    const faqs: Record<SeoLang, { q: string; a: string }[]> = {
        es: [
            { q: `¿Cuánto cuesta ${title}?`, a: `${title} está a la venta en DESCU por ${priceStr}. Es un artículo de segunda mano de la categoría ${cat}. Si pagas en línea se añade una comisión de servicio del ${SITE_FACTS.platformFeePercent}%; en efectivo no hay comisión.` },
            { q: `¿Cómo compro ${title} en DESCU?`, a: `Escribe al vendedor por el chat de DESCU, acuerda entrega en persona o envío ($${SITE_FACTS.shippingFeeMxn} MXN fijos) y paga con tarjeta, OXXO o SPEI con custodia, o en efectivo al recibirlo. En pagos en línea el dinero se libera al vendedor solo cuando confirmas la recepción.` },
            { q: `¿Dónde se entrega este artículo?`, a: `El artículo se encuentra en ${city}, México. Puedes recogerlo en persona coordinando el punto de encuentro por chat, o pedir envío a domicilio.` },
        ],
        en: [
            { q: `How much is ${title}?`, a: `${title} is listed on DESCU for ${priceStr}. It is a pre-owned item in the ${cat} category. Paying online adds a ${SITE_FACTS.platformFeePercent}% service fee; cash payments carry no fee.` },
            { q: `How do I buy ${title} on DESCU?`, a: `Message the seller in the DESCU chat, agree on an in-person handoff or shipping (flat MX$${SITE_FACTS.shippingFeeMxn}) and pay by card, OXXO or SPEI with escrow, or in cash on receipt. For online payments the money is released to the seller only after you confirm receipt.` },
            { q: `Where is this item located?`, a: `The item is in ${city}, Mexico. Pick it up in person by arranging a meeting point in the chat, or request home delivery.` },
        ],
        zh: [
            { q: `${title}多少钱？`, a: `${title}在 DESCU 上的售价为 ${priceStr}，属于${cat}类二手商品。在线支付需另付 ${SITE_FACTS.platformFeePercent}% 服务费，现金交易不收费。` },
            { q: `如何在 DESCU 购买${title}？`, a: `通过 DESCU 聊天联系卖家，约定当面交易或配送（固定 ${SITE_FACTS.shippingFeeMxn} 比索），可用银行卡、OXXO 或 SPEI 担保支付，或收货时付现。在线支付的款项在你确认收货后才释放给卖家。` },
            { q: `这个商品在哪里交易？`, a: `商品位于墨西哥${city}。可在聊天中约定见面地点当面取货，或选择送货上门。` },
        ],
    };
    return faqs[lang];
}

function productPage(p: Listing, related: Listing[], lang: SeoLang): string {
    const ui = UI[lang];
    const title = localized(p, 'title', lang) || 'Producto';
    const description = localized(p, 'description', lang) || SITE_TEXT[lang].shortDesc;
    const price = Number(p.price) || 0;
    const currency = p.currency || 'MXN';
    const priceStr = formatPrice(price, currency);
    const category = normalizeCategory(p.category);
    const catLabel = categoryLabel(category, lang);
    const images = (p.images || []).filter(Boolean);
    const mainImage = images[0] || OG_IMAGE;
    const path = `/product/${p.id}`;
    const url = `${BASE_URL}${path}`;
    const city = productCity(p);
    const status = p.status || 'active';
    const isSold = status === 'sold';
    const isActive = status === 'active';
    const sellerName = p.seller_name || (lang === 'en' ? 'DESCU seller' : lang === 'zh' ? 'DESCU 卖家' : 'Vendedor DESCU');
    const conditionSchema = p.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition';
    const availability = isSold ? 'https://schema.org/SoldOut' : isActive ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
    const faq = productFaq(p, lang);
    const shortDesc = truncate(description.replace(/\s+/g, ' ').trim(), 150);
    const metaDesc = `${priceStr} · ${shortDesc}`;
    const statusTag = isSold ? ` [${ui.sold}]` : !isActive ? ` [${ui.unavailable}]` : '';

    const crumbs = [
        { name: ui.home, path: '/' },
        { name: catLabel, path: landingPath(category, ALL_MEXICO_SLUG) },
        { name: title, path },
    ];
    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            breadcrumbSchema(crumbs),
            {
                '@type': 'Product',
                '@id': `${url}#product`,
                name: title,
                image: images.length > 0 ? images : [OG_IMAGE],
                description: shortDesc,
                sku: p.id,
                category: catLabel,
                itemCondition: conditionSchema,
                inLanguage: htmlLangFor(lang),
                ...(p.subcategory ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'subcategory', value: p.subcategory }] } : {}),
                offers: {
                    '@type': 'Offer',
                    url,
                    priceCurrency: currency,
                    price,
                    availability,
                    itemCondition: conditionSchema,
                    seller: { '@type': 'Person', name: sellerName },
                    areaServed: { '@type': 'Country', name: 'Mexico' },
                    ...(city ? {
                        availableAtOrFrom: {
                            '@type': 'Place',
                            name: p.location_display_name || city,
                            address: { '@type': 'PostalAddress', addressLocality: city, ...(p.town && p.town !== city ? { addressRegion: p.town } : {}), addressCountry: 'MX' },
                            ...(p.latitude && p.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } } : {}),
                        },
                    } : {}),
                },
            },
            { '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ],
    };

    const published = p.created_at ? new Date(p.created_at).toLocaleDateString(htmlLangFor(lang), { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const body = `
        <article>
            ${images.length > 0 ? `<div class="hero"><img src="${escapeHtml(mainImage)}" alt="${escapeHtml(title)}" width="800" height="520" /></div>` : ''}
            <h1>${escapeHtml(title)}${statusTag}</h1>
            <p class="price">${priceStr}</p>
            <dl>
                <dt>${ui.category}</dt><dd><a href="${withLang(landingPath(category, ALL_MEXICO_SLUG), lang)}">${escapeHtml(catLabel)}</a>${p.subcategory ? ` › ${escapeHtml(p.subcategory)}` : ''}</dd>
                <dt>${ui.condition}</dt><dd>${p.condition === 'new' ? ui.new : ui.used}</dd>
                <dt>${ui.seller}</dt><dd>${escapeHtml(sellerName)}</dd>
                ${city ? `<dt>${ui.location}</dt><dd>${escapeHtml(city)}, ${countryName(lang)}</dd>` : ''}
                <dt>${ui.payment}</dt><dd>${ui.paymentDesc}</dd>
                ${published ? `<dt>${ui.publishedOn}</dt><dd><time datetime="${escapeHtml(p.created_at || '')}">${escapeHtml(published)}</time></dd>` : ''}
            </dl>
            <h2>${ui.desc}</h2>
            <p>${escapeHtml(description).replace(/\n/g, '<br />')}</p>
            ${images.length > 1 ? `<ul class="grid">${images.slice(1, 5).map(img => `<li class="card"><img src="${escapeHtml(img)}" alt="${escapeHtml(title)}" loading="lazy" width="400" height="400" /></li>`).join('')}</ul>` : ''}
            <section class="faq">
                <h2>${ui.faq}</h2>
                ${faq.map(f => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}
            </section>
        </article>
        ${related.length > 0 ? `<h2>${ui.related}</h2>${listingGrid(related, lang)}` : ''}
        <h2>${ui.moreIn} ${escapeHtml(catLabel)}</h2>
        ${cityChips(lang, category)}`;

    const extraHead = `
    <meta property="product:price:amount" content="${price}" />
    <meta property="product:price:currency" content="${escapeHtml(currency)}" />
    <meta property="product:condition" content="${p.condition === 'new' ? 'new' : 'used'}" />
    <meta property="product:availability" content="${isSold ? 'out of stock' : isActive ? 'in stock' : 'out of stock'}" />
    ${city ? `<meta name="geo.placename" content="${escapeHtml(city)}" />` : ''}
    ${p.latitude && p.longitude ? `<meta name="geo.position" content="${p.latitude};${p.longitude}" />` : ''}`;

    return shell({
        lang, path, title: `${title} | ${priceStr} - DESCU`, description: metaDesc, ogType: 'product', ogImage: mainImage,
        // sold items stay indexable (SoldOut) — they still rank and link on; unreviewed / inactive ones do not
        robots: isActive || isSold ? undefined : 'noindex, follow',
        schema, body, breadcrumbs: crumbs, extraHead,
    });
}

function notFoundPage(lang: SeoLang): string {
    const t: Record<SeoLang, { title: string; body: string; back: string }> = {
        es: { title: 'Página no encontrada', body: 'El artículo que buscas ya no está disponible o el enlace es incorrecto.', back: 'Ver artículos recientes' },
        en: { title: 'Page not found', body: 'The item you are looking for is no longer available or the link is wrong.', back: 'Browse recent items' },
        zh: { title: '页面不存在', body: '你要找的商品已下架或链接有误。', back: '浏览最新商品' },
    };
    return `<!DOCTYPE html>
<html lang="${htmlLangFor(lang)}">
<head><meta charset="UTF-8" /><title>${t[lang].title} - DESCU</title><meta name="robots" content="noindex" /></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:40px">
    <h1>${t[lang].title}</h1><p>${t[lang].body}</p><a href="${withLang('/', lang)}">${t[lang].back}</a>
</body>
</html>`;
}

// ---------- handler ----------

const HTML = 'text/html; charset=utf-8';
const CACHE_SHORT = 'public, s-maxage=1800, stale-while-revalidate=3600';
const CACHE_LONG = 'public, s-maxage=3600, stale-while-revalidate=86400';

export default async function handler(req: any, res: any) {
    const rawPath: string = typeof req.query?.path === 'string' ? req.query.path : '';
    const pathParam = rawPath.replace(/\/+$/, '') || '/';
    const lang = parseSeoLang(req.query?.lang);
    res.setHeader('Content-Type', HTML);

    try {
        if (!supabaseUrl || !supabaseKey) throw new Error('Supabase not configured');
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (pathParam === '/') {
            const products = await fetchActive(supabase, { limit: 48 });
            res.setHeader('Cache-Control', CACHE_SHORT);
            return res.status(200).send(homePage(products, lang));
        }

        if (pathParam === HOW_IT_WORKS_PATH) {
            res.setHeader('Cache-Control', CACHE_LONG);
            return res.status(200).send(howItWorksPage(lang));
        }

        const landing = pathParam.match(/^\/buy\/([^/]+)\/in\/([^/]+)$/);
        if (landing) {
            const catSlug = decodeURIComponent(landing[1]).toLowerCase();
            const citySlug = decodeURIComponent(landing[2]).toLowerCase();
            const category = categoryFromSlug(catSlug);
            const city = citySlug === ALL_MEXICO_SLUG ? null : findCity(citySlug) ?? undefined;
            // unknown category or city slug → no such page
            if ((category === null && catSlug !== 'all') || city === undefined) {
                return res.status(404).send(notFoundPage(lang));
            }
            const pool = await fetchActive(supabase, { category, limit: city ? 1000 : 48 });
            const products = city ? pool.filter(p => productInCity(city, p)).slice(0, 48) : pool;
            res.setHeader('Cache-Control', CACHE_LONG);
            return res.status(200).send(landingPage(products, category, city, lang));
        }

        const productMatch = pathParam.match(/^\/product\/([a-zA-Z0-9_-]+)$/);
        if (!productMatch) return res.status(404).send(notFoundPage(lang));

        const { data: product } = await supabase.from('products').select('*').eq('id', productMatch[1]).maybeSingle();
        if (!product || product.deleted_at) return res.status(404).send(notFoundPage(lang));

        const related = await fetchActive(supabase, { category: normalizeCategory(product.category), limit: 6, exclude: product.id });
        res.setHeader('Cache-Control', CACHE_LONG);
        return res.status(200).send(productPage(product as Listing, related, lang));
    } catch (err) {
        console.error('[Prerender] Error:', err);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(500).send('Internal Server Error');
    }
}
