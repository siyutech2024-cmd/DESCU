
import { useEffect } from 'react';

interface SEOProps {
    title: string;
    description?: string;
    image?: string;
    url?: string;
}

export const useSEO = ({ title, description, image, url }: SEOProps) => {
    useEffect(() => {
        // Update Title
        document.title = title;

        // Helper to update meta tags
        const updateMeta = (name: string, content: string) => {
            let element = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
            if (!element) {
                element = document.createElement('meta');
                element.setAttribute(name.startsWith('og:') ? 'property' : 'name', name);
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        };

        if (description) {
            updateMeta('description', description);
            updateMeta('og:description', description);
        }

        updateMeta('og:title', title);

        if (image) {
            updateMeta('og:image', image);
        }

        if (url) {
            updateMeta('og:url', url);
        } else {
            updateMeta('og:url', window.location.href);
        }

        // Cleanup not strictly necessary for single page flows, 
        // but we might want to revert to default on unmount?
        // For now, next page will overwrite.
    }, [title, description, image, url]);
};
