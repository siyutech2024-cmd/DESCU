
import { useEffect } from 'react';

interface SEOProps {
    title: string;
    description?: string;
    image?: string;
    url?: string;
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
                element.setAttribute(name.startsWith('og:') || name.startsWith('twitter:') ? 'property' : 'name', name);
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
            formattedSchema = {
                "@context": "https://schema.org/",
                "@graph": [
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
                    {
                        "@type": "Product",
                        "name": product.title,
                        "image": (product.images && product.images.length > 0)
                            ? product.images
                            : ['https://descu.ai/og-image.png'],
                        "description": product.description,
                        "sku": product.id,
                        "brand": {
                            "@type": "Brand",
                            "name": product.seller?.name || "Vendedor DESCU"
                        },
                        "category": product.category,
                        "offers": {
                            "@type": "Offer",
                            "url": currentUrl,
                            "priceCurrency": product.currency || "MXN",
                            "price": product.price,
                            "availability": "https://schema.org/InStock",
                            "itemCondition": "https://schema.org/UsedCondition",
                            "seller": {
                                "@type": "Person",
                                "name": product.seller?.name || "Vendedor Verificado"
                            }
                        },
                        "availableAtOrFrom": {
                            "@type": "Place",
                            "address": {
                                "@type": "PostalAddress",
                                "addressCountry": "MX"
                            }
                        }
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
