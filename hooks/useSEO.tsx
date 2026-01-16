
import { useEffect } from 'react';

interface SEOProps {
    title: string;
    description?: string;
    image?: string;
    url?: string;
}


export const useSEO = ({ title, description, image, url, product }: SEOProps & { product?: any }) => {
    useEffect(() => {
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

        const desc = description || 'DESCU - The best AI-powered local marketplace.';
        const currentUrl = url || window.location.href;
        const img = image || 'https://www.descu.ai/og-image.png'; // Default OG Image

        updateMeta('description', desc);

        // OpenGraph
        updateMeta('og:title', title);
        updateMeta('og:description', desc);
        updateMeta('og:image', img);
        updateMeta('og:url', currentUrl);
        updateMeta('og:type', product ? 'product' : 'website');
        updateMeta('og:site_name', 'DESCU');

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

        // 2. Structured Data (JSON-LD)
        let script = document.querySelector('script[type="application/ld+json"]');

        let formattedSchema = null;

        if (product) {
            formattedSchema = {
                "@context": "https://schema.org/",
                "@type": "Product",
                "name": product.title,
                "image": product.images || [],
                "description": product.description,
                "sku": product.id,
                "brand": { "@type": "Brand", "name": "SecondHand" },
                "offers": {
                    "@type": "Offer",
                    "url": currentUrl,
                    "priceCurrency": product.currency || "MXN",
                    "price": product.price,
                    "availability": "https://schema.org/InStock",
                    "itemCondition": "https://schema.org/UsedCondition"
                }
            };
        } else {
            // Fallback: WebSite schema for Homepage
            formattedSchema = {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "DESCU",
                "url": "https://www.descu.ai/",
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": "https://www.descu.ai/?q={search_term_string}",
                    "query-input": "required name=search_term_string"
                }
            };
        }

        if (formattedSchema) {
            if (!script) {
                script = document.createElement('script');
                script.setAttribute('type', 'application/ld+json');
                document.head.appendChild(script);
            }
            script.textContent = JSON.stringify(formattedSchema);
        } else {
            if (script) script.remove();
        }

    }, [title, description, image, url, product]);
};
