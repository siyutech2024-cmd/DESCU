import { useEffect } from 'react';
import { useLanguage } from '@/i18n';
import { categoryLabelKey, normalizeCategory } from '@/features/products/categories';
import type { Language } from '@/types';

/**
 * Per-page <head> management for the SPA: title, description, canonical, hreflang alternates,
 * Open Graph / Twitter tags and a JSON-LD block that mirrors what the bot prerender
 * (api/prerender.ts) serves, so a page looks the same to a crawler that executes JS and to the
 * share-preview fetchers that do not.
 */

const BASE_URL = 'https://descu.ai';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const HTML_LANG: Record<Language, string> = { es: 'es-MX', en: 'en', zh: 'zh-CN' };
const OG_LOCALE: Record<Language, string> = { es: 'es_MX', en: 'en_US', zh: 'zh_CN' };

interface SEOProps {
    title: string;
    description?: string;
    image?: string;
    /** Canonical URL override (defaults to the current path, query stripped). */
    url?: string;
    /** Product for Product/Offer/FAQ structured data. */
    product?: any;
    /** Keep the page out of the index (404s, account screens). */
    noindex?: boolean;
}

const withLang = (path: string, lang: Language) => `${BASE_URL}${path}${lang === 'es' ? '' : `?lang=${lang}`}`;

const formatPrice = (price: number, currency = 'MXN') =>
    currency === 'MXN' ? `$${price.toLocaleString('es-MX')} MXN` : `$${price.toLocaleString('en-US')} ${currency}`;

/** Per-product FAQ (same wording as the prerender) so answer engines get a quotable Q&A. */
function productFAQ(product: any, lang: Language, categoryLabel: string) {
    const title = product.title || 'Producto';
    const priceStr = formatPrice(Number(product.price) || 0, product.currency || 'MXN');
    const city = product.city || product.town || (lang === 'en' ? 'Mexico' : lang === 'zh' ? '墨西哥' : 'México');
    const cat = categoryLabel.toLowerCase();
    const faqs: Record<Language, { q: string; a: string }[]> = {
        es: [
            { q: `¿Cuánto cuesta ${title}?`, a: `${title} está a la venta en DESCU por ${priceStr}. Es un artículo de segunda mano de la categoría ${cat}. Si pagas en línea se añade una comisión de servicio del 5%; en efectivo no hay comisión.` },
            { q: `¿Cómo compro ${title} en DESCU?`, a: `Escribe al vendedor por el chat de DESCU, acuerda entrega en persona o envío ($50 MXN fijos) y paga con tarjeta, OXXO o SPEI con custodia, o en efectivo al recibirlo. En pagos en línea el dinero se libera al vendedor solo cuando confirmas la recepción.` },
            { q: '¿Dónde se entrega este artículo?', a: `El artículo se encuentra en ${city}, México. Puedes recogerlo en persona coordinando el punto de encuentro por chat, o pedir envío a domicilio.` },
        ],
        en: [
            { q: `How much is ${title}?`, a: `${title} is listed on DESCU for ${priceStr}. It is a pre-owned item in the ${cat} category. Paying online adds a 5% service fee; cash payments carry no fee.` },
            { q: `How do I buy ${title} on DESCU?`, a: `Message the seller in the DESCU chat, agree on an in-person handoff or shipping (flat MX$50) and pay by card, OXXO or SPEI with escrow, or in cash on receipt. For online payments the money is released to the seller only after you confirm receipt.` },
            { q: 'Where is this item located?', a: `The item is in ${city}, Mexico. Pick it up in person by arranging a meeting point in the chat, or request home delivery.` },
        ],
        zh: [
            { q: `${title}多少钱？`, a: `${title}在 DESCU 上的售价为 ${priceStr}，属于${cat}类二手商品。在线支付需另付 5% 服务费，现金交易不收费。` },
            { q: `如何在 DESCU 购买${title}？`, a: `通过 DESCU 聊天联系卖家，约定当面交易或配送（固定 50 比索），可用银行卡、OXXO 或 SPEI 担保支付，或收货时付现。在线支付的款项在你确认收货后才释放给卖家。` },
            { q: '这个商品在哪里交易？', a: `商品位于墨西哥${city}。可在聊天中约定见面地点当面取货，或选择送货上门。` },
        ],
    };
    return faqs[lang].map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }));
}

const upsertMeta = (attr: 'name' | 'property', key: string, content: string | undefined) => {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!content) { el?.remove(); return; }
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const upsertLink = (selector: string, attrs: Record<string, string>) => {
    let el = document.head.querySelector<HTMLLinkElement>(selector);
    if (!el) {
        el = document.createElement('link');
        document.head.appendChild(el);
    }
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
};

export const useSEO = ({ title, description, image, url, product, noindex }: SEOProps) => {
    const { language, t } = useLanguage();

    useEffect(() => {
        const lang = language;
        document.documentElement.lang = HTML_LANG[lang];
        document.title = title;

        const path = window.location.pathname;
        const urlLang = new URLSearchParams(window.location.search).get('lang');
        // Canonical = path + the language variant actually requested (matches the prerender's per-language canonicals).
        const canonical = url || `${BASE_URL}${path}${urlLang === 'en' || urlLang === 'zh' ? `?lang=${urlLang}` : ''}`;
        const desc = description || t('hero.subtitle');
        const img = image || DEFAULT_IMAGE;

        upsertMeta('name', 'description', desc);
        upsertMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
        upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonical });

        // hreflang alternates for the current path (the SPA honours ?lang=)
        if (!url) {
            const alts: [string, string][] = [['es-MX', withLang(path, 'es')], ['en', withLang(path, 'en')], ['zh', withLang(path, 'zh')], ['x-default', withLang(path, 'es')]];
            for (const [hreflang, href] of alts) upsertLink(`link[rel="alternate"][hreflang="${hreflang}"]`, { rel: 'alternate', hreflang, href });
        }

        // Open Graph / Twitter
        upsertMeta('property', 'og:title', title);
        upsertMeta('property', 'og:description', desc);
        upsertMeta('property', 'og:image', img);
        upsertMeta('property', 'og:url', canonical);
        upsertMeta('property', 'og:type', product ? 'product' : 'website');
        upsertMeta('property', 'og:site_name', 'DESCU');
        upsertMeta('property', 'og:locale', OG_LOCALE[lang]);
        upsertMeta('name', 'twitter:card', 'summary_large_image');
        upsertMeta('name', 'twitter:title', title);
        upsertMeta('name', 'twitter:description', desc);
        upsertMeta('name', 'twitter:image', img);
        // index.html declares the default 1200×630 image; a product photo has unknown dimensions
        upsertMeta('property', 'og:image:width', image ? undefined : '1200');
        upsertMeta('property', 'og:image:height', image ? undefined : '630');

        upsertMeta('property', 'product:price:amount', product ? String(product.price || 0) : undefined);
        upsertMeta('property', 'product:price:currency', product ? product.currency || 'MXN' : undefined);
        upsertMeta('property', 'product:condition', product ? (product.condition === 'new' ? 'new' : 'used') : undefined);

        // JSON-LD for this page
        let schema: unknown;
        if (product) {
            const category = normalizeCategory(product.category);
            const categoryLabel = t(categoryLabelKey(category));
            const status = product.status || 'active';
            const availability = status === 'sold' ? 'https://schema.org/SoldOut' : status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
            const conditionSchema = product.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition';
            const city = product.city || product.town || '';
            const sellerName = product.seller?.name || product.seller_name || 'DESCU';
            const lat = product.location?.latitude ?? product.latitude;
            const lng = product.location?.longitude ?? product.longitude;
            const categoryPath = `/buy/${category.toLowerCase()}/in/mexico`;
            schema = {
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'BreadcrumbList',
                        itemListElement: [
                            { '@type': 'ListItem', position: 1, name: t('nav.home'), item: `${BASE_URL}/` },
                            { '@type': 'ListItem', position: 2, name: categoryLabel, item: `${BASE_URL}${categoryPath}` },
                            { '@type': 'ListItem', position: 3, name: product.title, item: canonical },
                        ],
                    },
                    {
                        '@type': 'Product',
                        '@id': `${canonical.split('?')[0]}#product`,
                        name: product.title,
                        image: product.images?.length ? product.images : [DEFAULT_IMAGE],
                        description: (product.description || '').slice(0, 300),
                        sku: product.id,
                        category: categoryLabel,
                        itemCondition: conditionSchema,
                        inLanguage: HTML_LANG[lang],
                        offers: {
                            '@type': 'Offer',
                            url: canonical,
                            priceCurrency: product.currency || 'MXN',
                            price: product.price,
                            availability,
                            itemCondition: conditionSchema,
                            seller: { '@type': 'Person', name: sellerName },
                            areaServed: { '@type': 'Country', name: 'Mexico' },
                            ...(city ? {
                                availableAtOrFrom: {
                                    '@type': 'Place',
                                    name: product.location_display_name || city,
                                    address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'MX' },
                                    ...(lat && lng ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {}),
                                },
                            } : {}),
                        },
                    },
                    { '@type': 'FAQPage', mainEntity: productFAQ(product, lang, categoryLabel) },
                ],
            };
        } else {
            schema = {
                '@context': 'https://schema.org',
                '@type': 'WebPage',
                name: title,
                description: desc,
                url: canonical,
                inLanguage: HTML_LANG[lang],
                isPartOf: { '@type': 'WebSite', name: 'DESCU', url: `${BASE_URL}/` },
            };
        }

        let script = document.getElementById('dynamic-seo-schema') as HTMLScriptElement | null;
        if (!script) {
            script = document.createElement('script');
            script.id = 'dynamic-seo-schema';
            script.type = 'application/ld+json';
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(schema).replace(/</g, '\\u003c');
    }, [title, description, image, url, product, noindex, language, t]);
};
