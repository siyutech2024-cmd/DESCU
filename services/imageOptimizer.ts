/**
 * Image optimization utilities for Supabase Storage.
 * 
 * Supabase Storage supports on-the-fly image transforms via URL params.
 * This module provides helpers to request optimized sizes for different contexts:
 * - Thumbnail (list views): 300px wide, low quality
 * - Medium (detail views): 800px wide, good quality
 * - Full (zoom/share): original
 */

type ImageSize = 'thumbnail' | 'medium' | 'full';

const SIZE_CONFIG: Record<ImageSize, { width: number; quality: number }> = {
    thumbnail: { width: 300, quality: 60 },
    medium: { width: 800, quality: 75 },
    full: { width: 1200, quality: 85 },
};

/**
 * Convert a Supabase Storage public URL to an optimized render URL.
 * 
 * Input:  https://xxx.supabase.co/storage/v1/object/public/products/0.123.jpg
 * Output: https://xxx.supabase.co/storage/v1/render/image/public/products/0.123.jpg?width=300&quality=60
 * 
 * Falls back to original URL if it's not a Supabase storage URL.
 */
export const getOptimizedImageUrl = (url: string, size: ImageSize = 'medium'): string => {
    if (!url) return url;

    const config = SIZE_CONFIG[size];

    // Check if it's a Supabase Storage URL
    if (url.includes('/storage/v1/object/public/')) {
        // Transform: /object/public/... → /render/image/public/...
        const renderUrl = url.replace(
            '/storage/v1/object/public/',
            '/storage/v1/render/image/public/'
        );
        return `${renderUrl}?width=${config.width}&quality=${config.quality}`;
    }

    // For non-Supabase URLs (e.g., external images), return as-is
    return url;
};

/**
 * Get a tiny placeholder URL for blur-up loading effect.
 * Returns a 20px wide version for use as CSS background while main image loads.
 */
export const getPlaceholderUrl = (url: string): string => {
    if (!url) return url;

    if (url.includes('/storage/v1/object/public/')) {
        const renderUrl = url.replace(
            '/storage/v1/object/public/',
            '/storage/v1/render/image/public/'
        );
        return `${renderUrl}?width=20&quality=20`;
    }

    return url;
};
