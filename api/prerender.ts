import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Bot User-Agent patterns
const BOT_PATTERNS = [
    'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'slurp',
    'baiduspider', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
    'whatsapp', 'telegrambot', 'applebot', 'pinterest', 'semrushbot',
    'ahrefsbot', 'mj12bot', 'dotbot', 'petalbot',
];

function isBot(userAgent: string): boolean {
    const ua = userAgent.toLowerCase();
    return BOT_PATTERNS.some(bot => ua.includes(bot));
}

// Detect language from Accept-Language header or query param
function detectLanguage(req: any): 'zh' | 'en' | 'es' {
    // Query param takes priority (?lang=zh)
    const queryLang = req.query?.lang;
    if (queryLang === 'zh' || queryLang === 'en' || queryLang === 'es') return queryLang;

    // Check Accept-Language header
    const acceptLang = (req.headers?.['accept-language'] || '').toLowerCase();
    if (acceptLang.includes('zh')) return 'zh';
    if (acceptLang.includes('en')) return 'en';
    // Default to Spanish (primary market: Mexico)
    return 'es';
}

function getLocalizedText(product: any, field: string, lang: 'zh' | 'en' | 'es'): string {
    // Try language-specific field first, then fallback chain
    const langField = `${field}_${lang}`;
    if (product[langField]) return product[langField];
    // Fallback: es → base → en → zh
    if (product[`${field}_es`]) return product[`${field}_es`];
    if (product[field]) return product[field];
    if (product[`${field}_en`]) return product[`${field}_en`];
    if (product[`${field}_zh`]) return product[`${field}_zh`];
    return '';
}

function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatPrice(price: number, currency: string = 'MXN'): string {
    if (currency === 'MXN') return `$${price.toLocaleString('es-MX')} MXN`;
    return `$${price.toLocaleString('en-US')} ${currency}`;
}

// Try to read the SPA index.html for non-bot requests
function getSpaHtml(): string | null {
    try {
        // In Vercel, the built files are in the output directory
        const possiblePaths = [
            path.join(process.cwd(), 'dist', 'index.html'),
            path.join(process.cwd(), 'index.html'),
            path.join(__dirname, '..', 'dist', 'index.html'),
            path.join(__dirname, '..', 'index.html'),
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return fs.readFileSync(p, 'utf-8');
            }
        }
    } catch (e) {
        // Ignore
    }
    return null;
}

export default async function handler(req: any, res: any) {
    const pathParam = req.query?.path || '';
    const productMatch = pathParam.match(/^\/product\/([a-zA-Z0-9_-]+)$/);

    if (!productMatch) {
        // Not a product page, return SPA
        const spaHtml = getSpaHtml();
        if (spaHtml) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(spaHtml);
        }
        return res.status(404).send('Not found');
    }

    const productId = productMatch[1];
    const userAgent = req.headers?.['user-agent'] || '';
    const isBotRequest = isBot(userAgent);
    const lang = detectLanguage(req);

    // For non-bot requests, serve the SPA shell with injected meta tags
    if (!isBotRequest) {
        const spaHtml = getSpaHtml();
        if (spaHtml) {
            // Inject minimal product meta tags into the SPA HTML head
            // The React app will handle full rendering
            try {
                if (supabaseUrl && supabaseKey) {
                    const supabase = createClient(supabaseUrl, supabaseKey);
                    const { data: product } = await supabase
                        .from('products')
                        .select('title, title_es, description, description_es, images, price, currency')
                        .eq('id', productId)
                        .single();

                    if (product) {
                        const title = getLocalizedText(product, 'title', lang) || 'Producto en DESCU';
                        const desc = getLocalizedText(product, 'description', lang) || '';
                        const img = product.images?.[0] || 'https://descu.ai/og-image.png';
                        const productUrl = `https://descu.ai/product/${productId}`;

                        // Replace the generic meta tags with product-specific ones
                        let modifiedHtml = spaHtml
                            .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)} - DESCU</title>`)
                            .replace(
                                /<meta name="description"[^>]*\/>/,
                                `<meta name="description" content="${escapeHtml(desc.substring(0, 160))}" />`
                            )
                            .replace(
                                /<meta property="og:title"[^>]*\/>/,
                                `<meta property="og:title" content="${escapeHtml(title)} - DESCU" />`
                            )
                            .replace(
                                /<meta property="og:description"[^>]*\/>/,
                                `<meta property="og:description" content="${escapeHtml(desc.substring(0, 200))}" />`
                            )
                            .replace(
                                /<meta property="og:image" content="[^"]*"[^>]*\/>/,
                                `<meta property="og:image" content="${escapeHtml(img)}" />`
                            )
                            .replace(
                                /<meta property="og:url"[^>]*\/>/,
                                `<meta property="og:url" content="${productUrl}" />`
                            )
                            .replace(
                                /<link rel="canonical"[^>]*\/>/,
                                `<link rel="canonical" href="${productUrl}" />`
                            );

                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
                        return res.status(200).send(modifiedHtml);
                    }
                }
            } catch (e) {
                // Fallback to original SPA
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(spaHtml);
        }
        return res.status(404).send('Not found');
    }

    // === BOT REQUEST: Full prerendered HTML ===
    try {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(404).send(generateNotFoundHtml());
        }

        const html = generateProductHtml(product, lang);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        res.status(200).send(html);
    } catch (err) {
        console.error('[Prerender] Error:', err);
        const spaHtml = getSpaHtml();
        if (spaHtml) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(spaHtml);
        }
        res.status(500).send('Internal Server Error');
    }
}

function generateProductHtml(product: any, lang: 'zh' | 'en' | 'es' = 'es'): string {
    const title = getLocalizedText(product, 'title', lang) || 'Producto en DESCU';
    const description = getLocalizedText(product, 'description', lang) || 'Artículo de segunda mano disponible en DESCU';
    const price = product.price || 0;
    const currency = product.currency || 'MXN';
    const category = product.category || 'Other';
    const images = product.images || [];
    const mainImage = images[0] || 'https://descu.ai/og-image.png';
    const productUrl = `https://descu.ai/product/${product.id}`;
    const sellerName = product.seller_name || 'Vendedor DESCU';
    const condition = product.condition || 'used';
    const priceStr = formatPrice(price, currency);

    // Localized labels
    const labels = {
        zh: { category: '分类', seller: '卖家', condition: '状况', new: '全新', used: '二手', desc: '商品描述', viewBtn: '在 DESCU 查看', home: '首页', marketplace: 'AI智能二手交易平台' },
        en: { category: 'Category', seller: 'Seller', condition: 'Condition', new: 'New', used: 'Used', desc: 'Description', viewBtn: 'View on DESCU', home: 'Home', marketplace: 'AI-Powered Secondhand Marketplace' },
        es: { category: 'Categoría', seller: 'Vendedor', condition: 'Condición', new: 'Nuevo', used: 'Usado', desc: 'Descripción', viewBtn: 'Ver en DESCU', home: 'Inicio', marketplace: 'Marketplace de Segunda Mano con IA' },
    };
    const l = labels[lang];
    const htmlLang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'es-MX';

    // OG description includes price for social previews (WhatsApp, Facebook, etc.)
    const ogDescription = `${priceStr} · ${description.substring(0, 150)}`;

    const conditionSchema = condition === 'new'
        ? 'https://schema.org/NewCondition'
        : 'https://schema.org/UsedCondition';

    const jsonLd = JSON.stringify({
        "@context": "https://schema.org/",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://descu.ai/" },
                    { "@type": "ListItem", "position": 2, "name": category, "item": `https://descu.ai/?category=${category}` },
                    { "@type": "ListItem", "position": 3, "name": title, "item": productUrl }
                ]
            },
            {
                "@type": "Product",
                "name": title,
                "image": images.length > 0 ? images : ['https://descu.ai/og-image.png'],
                "description": description,
                "sku": product.id,
                "brand": { "@type": "Brand", "name": sellerName },
                "category": category,
                "offers": {
                    "@type": "Offer",
                    "url": productUrl,
                    "priceCurrency": currency,
                    "price": price,
                    "availability": "https://schema.org/InStock",
                    "itemCondition": conditionSchema,
                    "seller": { "@type": "Person", "name": sellerName }
                },
                "availableAtOrFrom": {
                    "@type": "Place",
                    "address": { "@type": "PostalAddress", "addressCountry": "MX" }
                }
            }
        ]
    });

    return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | ${priceStr} - DESCU</title>
    <meta name="description" content="${escapeHtml(ogDescription)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${productUrl}" />

    <link rel="alternate" hreflang="es-MX" href="${productUrl}" />
    <link rel="alternate" hreflang="en" href="${productUrl}?lang=en" />
    <link rel="alternate" hreflang="zh" href="${productUrl}?lang=zh" />
    <link rel="alternate" hreflang="x-default" href="${productUrl}" />

    <meta property="og:type" content="product" />
    <meta property="og:url" content="${productUrl}" />
    <meta property="og:title" content="${escapeHtml(title)} | ${priceStr}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
    <meta property="og:image" content="${escapeHtml(mainImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="DESCU" />
    <meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : lang === 'en' ? 'en_US' : 'es_MX'}" />
    <meta property="product:price:amount" content="${price}" />
    <meta property="product:price:currency" content="${currency}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)} | ${priceStr}" />
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImage)}" />

    <script type="application/ld+json">${jsonLd}</script>

    <meta name="theme-color" content="#ec4899" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
</head>
<body>
    <div id="root">
        <header style="padding:20px;text-align:center;">
            <a href="https://descu.ai/" style="font-size:24px;font-weight:bold;color:#ec4899;text-decoration:none;">DESCU</a>
            <p>${escapeHtml(l.marketplace)}</p>
        </header>
        <main style="max-width:800px;margin:0 auto;padding:20px;">
            <nav style="margin-bottom:16px;font-size:14px;color:#666;">
                <a href="https://descu.ai/">${escapeHtml(l.home)}</a> &gt;
                <a href="https://descu.ai/?category=${escapeHtml(category)}">${escapeHtml(category)}</a> &gt;
                <span>${escapeHtml(title)}</span>
            </nav>
            ${images.length > 0 ? `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(title)}" style="width:100%;max-height:500px;object-fit:cover;border-radius:12px;" loading="lazy" />` : ''}
            <h1 style="font-size:24px;margin:16px 0 8px;">${escapeHtml(title)}</h1>
            <p style="font-size:28px;font-weight:bold;color:#ec4899;margin:8px 0;">${priceStr}</p>
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.category)}: ${escapeHtml(category)}</p>
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.seller)}: ${escapeHtml(sellerName)}</p>
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.condition)}: ${condition === 'new' ? escapeHtml(l.new) : escapeHtml(l.used)}</p>
            <div style="margin:16px 0;line-height:1.6;">
                <h2 style="font-size:18px;margin-bottom:8px;">${escapeHtml(l.desc)}</h2>
                <p>${escapeHtml(description)}</p>
            </div>
            <a href="${productUrl}" style="display:inline-block;background:#ec4899;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">${escapeHtml(l.viewBtn)}</a>
        </main>
        <footer style="text-align:center;padding:20px;color:#999;font-size:12px;">
            <p>&copy; 2024 DESCU. ${escapeHtml(l.marketplace)}</p>
        </footer>
    </div>
</body>
</html>`;
}

function generateNotFoundHtml(): string {
    return `<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8" />
    <title>Producto no encontrado - DESCU</title>
    <meta name="robots" content="noindex" />
    <meta name="description" content="Este producto ya no está disponible en DESCU." />
</head>
<body>
    <div id="root">
        <h1>Producto no encontrado</h1>
        <p>Este producto ya no está disponible. <a href="https://descu.ai/">Volver a DESCU</a></p>
    </div>
</body>
</html>`;
}
