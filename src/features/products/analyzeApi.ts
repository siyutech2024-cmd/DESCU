import { api } from '@/lib/api/client';
import type { Language } from '@/types';

/** Shape returned by POST /api/analyze (see api/_lib/controllers/aiController.ts PRODUCT_SCHEMA). */
export interface ProductAnalysis {
    title: string;
    description: string;
    /** lowercase: electronics | furniture | clothing | books | sports | vehicles | real_estate | services | other */
    category: string;
    subcategory?: string;
    suggestedPrice?: number;
    suggestedDeliveryType?: 'meetup' | 'shipping' | 'both';
}

/**
 * Ask the backend to describe a product photo. The Gemini key lives server-side only;
 * the browser never talks to Gemini directly.
 */
export const analyzeProductImage = (imageBase64: string, language: Language) =>
    api.post<ProductAnalysis>('/api/analyze', { image: imageBase64, language }, { auth: 'required' });
