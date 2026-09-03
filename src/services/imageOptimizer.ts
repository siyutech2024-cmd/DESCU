/**
 * Image optimization utilities.
 * 
 * Strategy: Since Supabase Storage image transforms require Pro plan,
 * we rely on client-side compression at upload time (see utils.ts compressImage).
 * This module provides size-aware URL helpers that can be extended later
 * when server-side transforms become available.
 * 
 * For now, all sizes return the original URL — the upload-time compression
 * (800px, 150KB target) ensures images are already optimized.
 */

type ImageSize = 'thumbnail' | 'medium' | 'full';

/**
 * Get an optimized image URL for the given size context.
 * Currently returns the original URL since Supabase image transforms
 * require Pro plan. Upload-side compression handles optimization.
 * 
 * When upgrading to Pro, uncomment the render/image transform below.
 */
export const getOptimizedImageUrl = (url: string, size: ImageSize = 'medium'): string => {
    if (!url) return url;

    // --- PRO PLAN: Uncomment below to enable server-side transforms ---
    // const SIZE_CONFIG: Record<ImageSize, { width: number; quality: number }> = {
    //   thumbnail: { width: 300, quality: 60 },
    //   medium: { width: 800, quality: 75 },
    //   full: { width: 1200, quality: 85 },
    // };
    // if (url.includes('/storage/v1/object/public/')) {
    //   const config = SIZE_CONFIG[size];
    //   const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    //   return `${renderUrl}?width=${config.width}&quality=${config.quality}`;
    // }

    return url;
};

/**
 * Get a tiny placeholder URL for blur-up loading effect.
 * Disabled until Pro plan is available.
 */
export const getPlaceholderUrl = (url: string): string => {
    return url;
};
