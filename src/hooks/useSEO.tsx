
import { useEffect } from 'react';

interface SEOProps {
    title: string;
    description?: string;
    image?: string;
    url?: string;
}

/**
 * 根据产品属性和当前语言自动生成 FAQ Schema
 * GEO 优化：让 AI 搜索引擎可以直接引用产品相关 FAQ
 */
function generateProductFAQ(product: any, lang: string) {
    const price = product.price || 0;
    const currency = product.currency || 'MXN';
    const priceStr = currency === 'MXN' ? `$${price.toLocaleString()} MXN` : `$${price} ${currency}`;
    const city = product.city || product.town || 'Ciudad de México';
    const categoryDisplay = product.category || 'general';

    const faqs: Record<string, Array<{ q: string; a: string }>> = {
        zh: [
            {
                q: `这个${product.title}的价格是多少？`,
                a: `这个${product.title}在DESCU上的售价为 ${priceStr}，属于${categoryDisplay}类别的二手商品。`
            },
            {
                q: `如何购买这个${product.title}？`,
                a: `在DESCU上，您可以直接联系卖家聊天，支持本地面交或通过平台安全支付（Stripe托管），确认收货后卖家才能收款。`
            },
            {
                q: `这个商品在哪里交易？`,
                a: `该商品位于${city}，墨西哥，支持本地面交。通过DESCU平台联系卖家安排见面地点。`
            }
        ],
        es: [
            {
                q: `¿Cuánto cuesta este ${product.title}?`,
                a: `Este ${product.title} está a la venta en DESCU por ${priceStr}. Es un artículo de segunda mano en la categoría ${categoryDisplay}.`
            },
            {
                q: `¿Cómo comprar este ${product.title} en DESCU?`,
                a: `Puedes contactar al vendedor directamente por chat en DESCU. La plataforma ofrece pago seguro con custodia (escrow) a través de Stripe. El dinero se retiene hasta que confirmes la recepción.`
            },
            {
                q: `¿Dónde se puede recoger este artículo?`,
                a: `Este artículo se encuentra en ${city}, México. Se puede coordinar la entrega en persona a través del chat de DESCU.`
            }
        ],
        en: [
            {
                q: `How much does this ${product.title} cost?`,
                a: `This ${product.title} is listed on DESCU for ${priceStr}. It's a pre-owned item in the ${categoryDisplay} category.`
            },
            {
                q: `How to buy this ${product.title} on DESCU?`,
                a: `You can chat directly with the seller on DESCU. The platform offers secure escrow payments via Stripe — funds are held until you confirm receipt of the item.`
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


export const useSEO = ({ title, description, image, url, product }: SEOProps & { product?: any }) => {
    useEffect(() => {
        // Ensure lang attribute is always es-MX for Mexico targeting
        document.documentElement.lang = 'es-MX';

        // 1. Basic Meta Tags
        document.title = title;

        const updateMeta = (name: string, content: string) => {
            if (!content) return;
            let element = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
            if (!element) {
                element = document.createElement('meta');
                element.setAttribute(name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('product:') ? 'property' : 'name', name);
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        };

        const desc = description || 'DESCU - Marketplace de segunda mano con IA en México. Compra y vende artículos usados cerca de ti.';
        const currentUrl = url || window.location.href;
        const img = image || 'https://descu.ai/og-image.png';

        updateMeta('description', desc);

        // OpenGraph
        updateMeta('og:title', title);
        updateMeta('og:description', desc);
        updateMeta('og:image', img);
        updateMeta('og:url', currentUrl);
        updateMeta('og:type', product ? 'product' : 'website');
        updateMeta('og:site_name', 'DESCU');
        updateMeta('og:locale', 'es_MX');

        // Twitter Card
        updateMeta('twitter:card', 'summary_large_image');
        updateMeta('twitter:title', title);
        updateMeta('twitter:description', desc);
        updateMeta('twitter:image', img);

        // Product-specific OG meta (GEO: helps AI engines extract pricing)
        if (product) {
            updateMeta('product:price:amount', String(product.price || 0));
            updateMeta('product:price:currency', product.currency || 'MXN');
            updateMeta('product:condition', 'used');
        }

        // Canonical
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', currentUrl);

        // 2. Structured Data (JSON-LD) — Dynamic per page
        let script = document.querySelector('script[id="dynamic-seo-schema"]');

        let formattedSchema = null;

        if (product) {
            // Determine availability based on product status
            const availability = product.status === 'sold'
                ? 'https://schema.org/SoldOut'
                : 'https://schema.org/InStock';

            const conditionSchema = product.condition === 'new'
                ? 'https://schema.org/NewCondition'
                : 'https://schema.org/UsedCondition';

            const city = product.city || product.town || 'Ciudad de México';
            const sellerName = product.seller?.name || 'Vendedor DESCU';

            formattedSchema = {
                "@context": "https://schema.org/",
                "@graph": [
                    // 1. Breadcrumb
                    {
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            {
                                "@type": "ListItem",
                                "position": 1,
                                "name": "Inicio",
                                "item": "https://descu.ai/"
                            },
                            {
                                "@type": "ListItem",
                                "position": 2,
                                "name": product.category || "Productos",
                                "item": `https://descu.ai/?category=${product.category || 'all'}`
                            },
                            {
                                "@type": "ListItem",
                                "position": 3,
                                "name": product.title,
                                "item": currentUrl
                            }
                        ]
                    },
                    // 2. Product (GEO Enhanced)
                    {
                        "@type": "Product",
                        "name": product.title,
                        "image": (product.images && product.images.length > 0)
                            ? product.images
                            : ['https://descu.ai/og-image.png'],
                        "description": product.geo_description || product.description,
                        "sku": product.id,
                        "brand": {
                            "@type": "Brand",
                            "name": sellerName
                        },
                        "category": product.category,
                        // GEO: item condition — critical for secondhand marketplace
                        "itemCondition": conditionSchema,
                        // GEO: language of content
                        "inLanguage": "es-MX",
                        "offers": {
                            "@type": "Offer",
                            "url": currentUrl,
                            "priceCurrency": product.currency || "MXN",
                            "price": product.price,
                            "availability": availability,
                            "itemCondition": conditionSchema,
                            "seller": {
                                "@type": "Person",
                                "name": sellerName
                            },
                            // GEO: shipping / delivery info for local marketplace
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
                        // GEO: precise pickup location
                        "availableAtOrFrom": {
                            "@type": "Place",
                            "name": product.location_display_name || city,
                            "address": {
                                "@type": "PostalAddress",
                                "addressLocality": city,
                                "addressRegion": product.town || product.district || '',
                                "addressCountry": "MX"
                            },
                            ...(product.location?.latitude && product.location?.longitude ? {
                                "geo": {
                                    "@type": "GeoCoordinates",
                                    "latitude": product.location.latitude,
                                    "longitude": product.location.longitude
                                }
                            } : {})
                        },
                        // GEO: country of origin for marketplace context
                        "countryOfOrigin": {
                            "@type": "Country",
                            "name": "Mexico"
                        }
                    },
                    // 3. GEO: Per-product FAQ Schema
                    {
                        "@type": "FAQPage",
                        "mainEntity": generateProductFAQ(product, 'es')
                    }
                ]
            };
        } else {
            formattedSchema = {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "WebSite",
                        "name": "DESCU Marketplace",
                        "url": "https://descu.ai/",
                        "inLanguage": "es-MX",
                        "potentialAction": {
                            "@type": "SearchAction",
                            "target": "https://descu.ai/?search={search_term_string}",
                            "query-input": "required name=search_term_string"
                        },
                        "description": "Marketplace de segunda mano con IA en México. Compra y vende artículos usados de forma segura."
                    },
                    {
                        "@type": "CollectionPage",
                        "name": title,
                        "description": desc,
                        "url": currentUrl,
                        "inLanguage": "es-MX"
                    }
                ]
            };
        }

        if (formattedSchema) {
            if (!script) {
                script = document.createElement('script');
                script.id = 'dynamic-seo-schema';
                script.setAttribute('type', 'application/ld+json');
                document.head.appendChild(script);
            }
            script.textContent = JSON.stringify(formattedSchema);
        }
    }, [title, description, image, url, product]);
};
