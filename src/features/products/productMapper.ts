import type { Coordinates, Product } from '@/types';
import { calculateDistance } from '@/services/utils';
import { avatarFor } from '@/features/auth/authService';

/** Raw product row as returned by GET /api/products. */
export interface ApiProduct {
    id: string;
    seller_id: string;
    seller_name?: string;
    seller_email?: string;
    seller_avatar?: string;
    seller_verified?: boolean;
    seller_info?: unknown;
    title: string;
    description: string;
    title_zh?: string;
    title_en?: string;
    title_es?: string;
    description_zh?: string;
    description_en?: string;
    description_es?: string;
    price: number;
    currency: string;
    images?: string[];
    category: string;
    subcategory?: string;
    delivery_type: string;
    latitude?: number;
    longitude?: number;
    location_name?: string;
    country?: string;
    city?: string;
    town?: string;
    district?: string;
    location_display_name?: string;
    created_at: string;
    is_promoted?: boolean;
    status?: string;
    source_language?: string;
}

/** Convert an API row into the app's Product shape, computing distance from `origin`. */
export const mapApiProduct = (p: ApiProduct, origin: Coordinates | null): Product => {
    const location: Coordinates = {
        latitude: p.latitude ?? origin?.latitude ?? 0,
        longitude: p.longitude ?? origin?.longitude ?? 0,
    };

    return {
        id: p.id,
        seller: {
            id: p.seller_id,
            name: p.seller_name || 'User',
            email: p.seller_email || '',
            avatar: p.seller_avatar || avatarFor(p.seller_id),
            isVerified: p.seller_verified || false,
            ...(p.seller_info !== undefined ? { seller_info: p.seller_info } : {}),
        } as Product['seller'],
        title: p.title,
        description: p.description,
        title_zh: p.title_zh,
        title_en: p.title_en,
        title_es: p.title_es,
        description_zh: p.description_zh,
        description_en: p.description_en,
        description_es: p.description_es,
        price: p.price,
        currency: p.currency,
        images: p.images || [],
        category: p.category as Product['category'],
        subcategory: p.subcategory,
        deliveryType: p.delivery_type as Product['deliveryType'],
        location,
        locationName: p.location_name || 'Unknown',
        country: p.country,
        city: p.city,
        town: p.town,
        district: p.district,
        location_display_name: p.location_display_name,
        source_language: p.source_language,
        createdAt: new Date(p.created_at).getTime(),
        isPromoted: p.is_promoted || false,
        status: p.status as Product['status'],
        distance: origin ? calculateDistance(origin, location) : undefined,
    };
};
