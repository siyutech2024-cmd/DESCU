import { api } from '@/lib/api/client';
import type { Language } from '@/types';
import type { ApiProduct } from './productMapper';

export const PRODUCTS_PAGE_SIZE = 20;

export interface ListProductsParams {
    language: Language;
    page: number;
    limit?: number;
    sellerId?: string;
}

export const listProducts = ({ language, page, limit = PRODUCTS_PAGE_SIZE, sellerId }: ListProductsParams, signal?: AbortSignal) =>
    api.get<ApiProduct[]>('/api/products', {
        params: { lang: language, limit, offset: (page - 1) * limit, seller_id: sellerId },
        signal,
    });

export const getProduct = (id: string, language: Language, signal?: AbortSignal) =>
    api.get<ApiProduct>(`/api/products/${id}`, { params: { lang: language }, signal });

/** Payload accepted by POST /api/products. */
export interface CreateProductPayload {
    seller_id: string;
    seller_name: string;
    seller_email: string;
    seller_avatar: string;
    seller_verified: boolean;
    title: string;
    description: string;
    price: number;
    currency: string;
    images: string[];
    category: string;
    subcategory: string | null;
    source_language: Language;
    delivery_type: string;
    latitude: number;
    longitude: number;
    location_name: string;
    country: string;
    city: string;
    town: string | null;
    district: string | null;
    location_display_name: string;
}

export const createProduct = (payload: CreateProductPayload) =>
    api.post<ApiProduct>('/api/products', payload, { auth: 'required' });
