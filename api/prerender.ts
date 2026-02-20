import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Detect language from query param only (?lang=zh|en|es)
// Since this endpoint only serves bots/crawlers (filtered by vercel.json UA condition),
// we default to Spanish (Mexico market). Accept-Language is unreliable for crawlers.
function detectLanguage(req: any): 'zh' | 'en' | 'es' {
    const queryLang = req.query?.lang;
    if (queryLang === 'zh' || queryLang === 'en' || queryLang === 'es') return queryLang;
    return 'es';
}

function getLocalizedText(product: any, field: string, lang: 'zh' | 'en' | 'es'): string {
    const langField = `${field}_${lang}`;
    if (product[langField]) return product[langField];
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

/**
 * GEO: Generate per-product FAQ for AI search engines
 * These FAQs are dynamically generated based on product attributes
 */
function generateProductFAQ(product: any, lang: 'zh' | 'en' | 'es') {
    const title = getLocalizedText(product, 'title', lang) || product.title || 'Product';
    const price = product.price || 0;
    const currency = product.currency || 'MXN';
    const priceStr = formatPrice(price, currency);
    const city = product.city || product.town || 'Ciudad de México';
    const category = product.category || 'general';

    const faqs: Record<string, Array<{ q: string; a: string }>> = {
        zh: [
            {
                q: `这个${title}的价格是多少？`,
                a: `这个${title}在DESCU上的售价为 ${priceStr}，属于${category}类别的二手商品。DESCU是墨西哥领先的AI驱动二手交易平台。`
            },
            {
                q: `如何在DESCU上购买这个${title}？`,
                a: `在DESCU上，您可以直接通过平台聊天联系卖家，支持本地面交或通过Stripe安全托管支付。买家确认收货后，资金才会释放给卖家。`
            },
            {
                q: `这个商品在墨西哥哪里可以交易？`,
                a: `该商品位于${city}，墨西哥。通过DESCU平台可以和卖家聊天安排就近面交地点。`
            }
        ],
        es: [
            {
                q: `¿Cuánto cuesta este ${title}?`,
                a: `Este ${title} está a la venta en DESCU por ${priceStr}. Es un artículo de segunda mano en la categoría ${category}. DESCU es el marketplace líder de segunda mano con IA en México.`
            },
            {
                q: `¿Cómo comprar este ${title} en DESCU?`,
                a: `Puedes contactar al vendedor directamente por chat en la app de DESCU. La plataforma ofrece pago seguro con custodia (escrow) a través de Stripe. Tu dinero está protegido hasta que confirmes la recepción del producto.`
            },
            {
                q: `¿Dónde puedo recoger este artículo?`,
                a: `Este artículo se encuentra en ${city}, México. Puedes coordinar la entrega en persona con el vendedor a través del chat de DESCU.`
            }
        ],
        en: [
            {
                q: `How much does this ${title} cost?`,
                a: `This ${title} is listed on DESCU for ${priceStr}. It's a pre-owned item in the ${category} category. DESCU is Mexico's leading AI-powered secondhand marketplace.`
            },
            {
                q: `How to buy this ${title} on DESCU?`,
                a: `You can chat directly with the seller on the DESCU app. The platform offers secure escrow payments via Stripe — your money is protected until you confirm receipt of the item.`
            },
            {
                q: `Where is this item located?`,
                a: `This item is available for local pickup in ${city}, Mexico. Contact the seller through DESCU chat to arrange a meeting point.`
            }
        ]
    };

    const langFAQs = faqs[lang] || faqs['es'];
    return langFAQs.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.a
        }
    }));
}

/**
 * Generate a GEO description — AI-friendly natural language paragraph
 * that contextualizes the product for generative search engines.
 */
function generateGeoDescription(product: any, lang: 'zh' | 'en' | 'es'): string {
    const title = getLocalizedText(product, 'title', lang) || product.title || 'Producto';
    const price = formatPrice(product.price || 0, product.currency || 'MXN');
    const city = product.city || product.town || 'Ciudad de México';
    const category = product.category || 'general';
    const delivery = product.delivery_type || 'both';

    const deliveryMap: Record<string, Record<string, string>> = {
        meetup: { es: 'entrega en persona', en: 'local pickup', zh: '当面交易' },
        shipping: { es: 'envío a domicilio', en: 'shipping available', zh: '支持邮寄' },
        both: { es: 'entrega en persona o envío', en: 'local pickup or shipping', zh: '当面交易或邮寄' }
    };
    const deliveryStr = deliveryMap[delivery]?.[lang] || deliveryMap['both'][lang];

    const templates: Record<string, string> = {
        es: `${title} disponible en ${city}, México por ${price}. Artículo de segunda mano en la categoría ${category}. Disponible para ${deliveryStr}. Compra de forma segura en DESCU con pago en custodia vía Stripe.`,
        en: `${title} available in ${city}, Mexico for ${price}. Pre-owned item in the ${category} category. Available for ${deliveryStr}. Buy safely on DESCU with Stripe escrow payment.`,
        zh: `${title} 位于墨西哥${city}，售价 ${price}。${category}类别的二手商品。支持${deliveryStr}。通过DESCU平台Stripe安全托管支付购买。`
    };

    return templates[lang] || templates['es'];
}

export default async function handler(req: any, res: any) {
    const pathParam = req.query?.path || '';
    const lang = detectLanguage(req);

    try {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Homepage prerender — ItemList with latest products for bot discovery
        if (pathParam === '/' || pathParam === '') {
            const { data: products } = await supabase
                .from('products')
                .select('id, title, title_es, title_en, title_zh, price, currency, images, category, city, town, status')
                .eq('status', 'active')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(50);

            const html = generateHomepageHtml(products || [], lang);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
            return res.status(200).send(html);
        }

        // Product page prerender
        const productMatch = pathParam.match(/^\/product\/([a-zA-Z0-9_-]+)$/);
        if (!productMatch) {
            return res.status(404).send(generateNotFoundHtml());
        }

        const productId = productMatch[1];

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
        res.status(500).send('Internal Server Error');
    }
}

function generateNotFoundHtml(): string {
    return `<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8" />
    <title>Producto no encontrado - DESCU</title>
    <meta name="robots" content="noindex" />
</head>
<body>
    <h1>Producto no encontrado</h1>
    <p>El producto que buscas no está disponible.</p>
    <a href="https://descu.ai/">Volver a DESCU</a>
</body>
</html>`;
}

function generateProductHtml(product: any, lang: 'zh' | 'en' | 'es' = 'es'): string {
    const title = getLocalizedText(product, 'title', lang) || 'Producto en DESCU';
    const description = getLocalizedText(product, 'description', lang) || 'Artículo de segunda mano disponible en DESCU';
    const price = product.price || 0;
    const currency = product.currency || 'MXN';
    const category = product.category || 'Other';
    const subcategory = product.subcategory || '';
    const images = product.images || [];
    const mainImage = images[0] || 'https://descu.ai/og-image.png';
    const productUrl = `https://descu.ai/product/${product.id}`;
    const sellerName = product.seller_name || 'Vendedor DESCU';
    const condition = product.condition || 'used';
    const priceStr = formatPrice(price, currency);
    const city = product.city || product.town || 'Ciudad de México';
    const status = product.status || 'active';

    // Localized labels
    const labels = {
        zh: { category: '分类', seller: '卖家', condition: '状况', new: '全新', used: '二手', desc: '商品描述', viewBtn: '在 DESCU 查看', home: '首页', marketplace: 'AI智能二手交易平台', location: '交易地点', payment: '支付方式', paymentDesc: 'Stripe安全托管支付（Escrow）', faqTitle: '常见问题' },
        en: { category: 'Category', seller: 'Seller', condition: 'Condition', new: 'New', used: 'Used', desc: 'Description', viewBtn: 'View on DESCU', home: 'Home', marketplace: 'AI-Powered Secondhand Marketplace', location: 'Location', payment: 'Payment', paymentDesc: 'Secure escrow payment via Stripe', faqTitle: 'Frequently Asked Questions' },
        es: { category: 'Categoría', seller: 'Vendedor', condition: 'Condición', new: 'Nuevo', used: 'Usado', desc: 'Descripción', viewBtn: 'Ver en DESCU', home: 'Inicio', marketplace: 'Marketplace de Segunda Mano con IA', location: 'Ubicación', payment: 'Método de pago', paymentDesc: 'Pago seguro con custodia (escrow) vía Stripe', faqTitle: 'Preguntas Frecuentes' },
    };
    const l = labels[lang];
    const htmlLang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'es-MX';

    // OG description includes price for social previews (WhatsApp, Facebook, etc.)
    const ogDescription = `${priceStr} · ${description.substring(0, 150)}`;

    const conditionSchema = condition === 'new'
        ? 'https://schema.org/NewCondition'
        : 'https://schema.org/UsedCondition';

    const availabilitySchema = status === 'sold'
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock';

    // GEO: Generate FAQ for this product
    const faqEntities = generateProductFAQ(product, lang);

    // GEO-enhanced JSON-LD with FAQ, shipping, and rich product data
    const jsonLd = JSON.stringify({
        "@context": "https://schema.org/",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": l.home, "item": "https://descu.ai/" },
                    { "@type": "ListItem", "position": 2, "name": category, "item": `https://descu.ai/?category=${category}` },
                    { "@type": "ListItem", "position": 3, "name": title, "item": productUrl }
                ]
            },
            {
                "@type": "Product",
                "name": title,
                "image": images.length > 0 ? images : ['https://descu.ai/og-image.png'],
                "description": generateGeoDescription(product, lang),
                "sku": product.id,
                "brand": { "@type": "Brand", "name": sellerName },
                "category": category,
                // GEO-enhanced fields
                "itemCondition": conditionSchema,
                "inLanguage": htmlLang,
                "countryOfOrigin": { "@type": "Country", "name": "Mexico" },
                ...(subcategory ? { "additionalType": subcategory } : {}),
                "offers": {
                    "@type": "Offer",
                    "url": productUrl,
                    "priceCurrency": currency,
                    "price": price,
                    "availability": availabilitySchema,
                    "itemCondition": conditionSchema,
                    "seller": { "@type": "Person", "name": sellerName },
                    "shippingDetails": {
                        "@type": "OfferShippingDetails",
                        "shippingDestination": {
                            "@type": "DefinedRegion",
                            "addressCountry": "MX"
                        },
                        "deliveryTime": {
                            "@type": "ShippingDeliveryTime",
                            "handlingTime": {
                                "@type": "QuantitativeValue",
                                "minValue": 0,
                                "maxValue": 1,
                                "unitCode": "DAY"
                            }
                        }
                    }
                },
                "availableAtOrFrom": {
                    "@type": "Place",
                    "name": product.location_display_name || city,
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": city,
                        "addressRegion": product.town || product.district || '',
                        "addressCountry": "MX"
                    },
                    ...(product.latitude && product.longitude ? {
                        "geo": {
                            "@type": "GeoCoordinates",
                            "latitude": product.latitude,
                            "longitude": product.longitude
                        }
                    } : {})
                }
            },
            // GEO: Per-product FAQ Schema
            {
                "@type": "FAQPage",
                "mainEntity": faqEntities
            }
        ]
    });

    // GEO: Generate visible FAQ HTML for AI crawlers to parse
    const faqHtml = faqEntities.map((faq: any) =>
        `<div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
            <h3 itemprop="name">${escapeHtml(faq.name)}</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
                <p itemprop="text">${escapeHtml(faq.acceptedAnswer.text)}</p>
            </div>
        </div>`
    ).join('\n');

    return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | ${priceStr} - DESCU</title>
    <meta name="description" content="${escapeHtml(ogDescription)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${productUrl}" />

    <!-- GEO: Product-level geo meta tags -->
    <meta name="geo.region" content="MX" />
    <meta name="geo.placename" content="${escapeHtml(city)}" />
    ${product.latitude && product.longitude ? `<meta name="geo.position" content="${product.latitude};${product.longitude}" />
    <meta name="ICBM" content="${product.latitude}, ${product.longitude}" />` : ''}

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
    <meta property="product:condition" content="${condition}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)} | ${priceStr}" />
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImage)}" />

    <script type="application/ld+json">${jsonLd}</script>
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
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.category)}: ${escapeHtml(category)}${subcategory ? ` > ${escapeHtml(subcategory)}` : ''}</p>
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.seller)}: ${escapeHtml(sellerName)}</p>
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.condition)}: ${condition === 'new' ? escapeHtml(l.new) : escapeHtml(l.used)}</p>
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.location)}: ${escapeHtml(city)}, México</p>
            <p style="color:#666;margin:4px 0;">${escapeHtml(l.payment)}: ${escapeHtml(l.paymentDesc)}</p>
            <div style="margin:16px 0;line-height:1.6;">
                <h2 style="font-size:18px;margin-bottom:8px;">${escapeHtml(l.desc)}</h2>
                <p>${escapeHtml(description)}</p>
            </div>
            <section style="margin:24px 0;line-height:1.6;" itemscope itemtype="https://schema.org/FAQPage">
                <h2 style="font-size:18px;margin-bottom:12px;">${escapeHtml(l.faqTitle)}</h2>
                ${faqHtml}
            </section>
        </main>
        <footer style="text-align:center;padding:20px;color:#999;font-size:12px;">
            <p>&copy; 2024 DESCU. ${escapeHtml(l.marketplace)}</p>
        </footer>
    </div>
</body>
</html>`;
}

function generateHomepageHtml(products: any[], lang: 'zh' | 'en' | 'es'): string {
    const baseUrl = 'https://descu.ai';
    const htmlLang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'es-MX';

    const labels: Record<string, Record<string, string>> = {
        zh: { title: 'DESCU - AI驱动二手交易平台 | 墨西哥', desc: 'DESCU是墨西哥领先的AI驱动二手交易平台。拍照即可自动识别、定价、发布。', marketplace: 'AI智能二手交易平台', browse: '浏览所有商品' },
        en: { title: 'DESCU - AI-Powered Secondhand Marketplace | Mexico', desc: 'DESCU is Mexico\'s leading AI-powered marketplace. Snap a photo to auto-identify, price, and list items.', marketplace: 'AI-Powered Secondhand Marketplace', browse: 'Browse All Items' },
        es: { title: 'DESCU - Compra y Vende Segunda Mano con IA | México', desc: 'DESCU es el marketplace de segunda mano con inteligencia artificial en México. Publica con IA en un clic.', marketplace: 'Marketplace de Segunda Mano con IA', browse: 'Ver Todos los Artículos' },
    };
    const l = labels[lang] || labels['es'];

    // Build ItemList JSON-LD schema for all products
    const itemListEntries = products.map((p, idx) => {
        const title = getLocalizedText(p, 'title', lang) || p.title || 'Product';
        const image = (p.images && p.images[0]) || `${baseUrl}/og-image.png`;
        return {
            "@type": "ListItem",
            "position": idx + 1,
            "url": `${baseUrl}/product/${p.id}`,
            "name": title,
            "image": image
        };
    });

    const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "name": "DESCU",
                "url": baseUrl,
                "inLanguage": htmlLang,
                "description": l.desc,
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": `${baseUrl}/?search={search_term_string}`,
                    "query-input": "required name=search_term_string"
                }
            },
            {
                "@type": "ItemList",
                "name": l.browse,
                "numberOfItems": products.length,
                "itemListElement": itemListEntries
            }
        ]
    });

    // Generate HTML product cards for bots to crawl
    const productCardsHtml = products.map(p => {
        const title = getLocalizedText(p, 'title', lang) || p.title || 'Product';
        const price = formatPrice(p.price || 0, p.currency || 'MXN');
        const image = (p.images && p.images[0]) || '';
        const city = p.city || p.town || '';
        return `<article style="border:1px solid #eee;border-radius:12px;padding:12px;margin-bottom:12px;">
            ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="width:100%;height:200px;object-fit:cover;border-radius:8px;" loading="lazy" />` : ''}
            <h2 style="font-size:16px;margin:8px 0 4px;"><a href="${baseUrl}/product/${p.id}" style="color:#333;text-decoration:none;">${escapeHtml(title)}</a></h2>
            <p style="font-size:20px;font-weight:bold;color:#ec4899;margin:4px 0;">${price}</p>
            ${city ? `<p style="font-size:13px;color:#888;margin:2px 0;">📍 ${escapeHtml(city)}</p>` : ''}
            <p style="font-size:13px;color:#888;margin:2px 0;">${escapeHtml(p.category || '')}</p>
        </article>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(l.title)}</title>
    <meta name="description" content="${escapeHtml(l.desc)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${baseUrl}/" />

    <meta name="geo.region" content="MX" />
    <meta name="geo.placename" content="México" />
    <meta name="geo.position" content="19.4326;-99.1332" />
    <meta name="ICBM" content="19.4326, -99.1332" />

    <link rel="alternate" hreflang="es-MX" href="${baseUrl}/" />
    <link rel="alternate" hreflang="en" href="${baseUrl}/?lang=en" />
    <link rel="alternate" hreflang="zh" href="${baseUrl}/?lang=zh" />
    <link rel="alternate" hreflang="x-default" href="${baseUrl}/" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}/" />
    <meta property="og:title" content="${escapeHtml(l.title)}" />
    <meta property="og:description" content="${escapeHtml(l.desc)}" />
    <meta property="og:image" content="${baseUrl}/og-image.png" />
    <meta property="og:site_name" content="DESCU" />
    <meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : lang === 'en' ? 'en_US' : 'es_MX'}" />

    <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
    <div id="root">
        <header style="padding:20px;text-align:center;">
            <a href="${baseUrl}/" style="font-size:24px;font-weight:bold;color:#ec4899;text-decoration:none;">DESCU</a>
            <p>${escapeHtml(l.marketplace)}</p>
        </header>
        <main style="max-width:800px;margin:0 auto;padding:20px;">
            <h1 style="font-size:22px;margin-bottom:16px;">${escapeHtml(l.browse)} (${products.length})</h1>
            ${productCardsHtml}
        </main>
        <footer style="text-align:center;padding:20px;color:#999;font-size:12px;">
            <p>&copy; 2024 DESCU. ${escapeHtml(l.marketplace)}</p>
        </footer>
    </div>
</body>
</html>`;
}
