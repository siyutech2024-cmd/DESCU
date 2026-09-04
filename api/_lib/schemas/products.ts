import { z } from 'zod';

/** Client-input schemas for /api/products (productController.ts). */

export const PRODUCT_DELIVERY_TYPES = ['meetup', 'shipping', 'both'] as const;
export const PRODUCT_LANGUAGES = ['zh', 'en', 'es'] as const;
export const PRODUCT_MAX_PRICE = 100_000_000;
export const PRODUCT_MAX_IMAGES = 10;

const optionalText = (max: number) => z.string().max(max).nullable().optional();

/**
 * Body of POST /api/products — the columns the listing form sends (src/features/products/productsApi.ts).
 * `seller_id`, `seller_email` and `seller_verified` are also sent but are deliberately NOT accepted:
 * they come from the verified auth user / are admin-granted. Unknown keys are stripped.
 */
export const CreateProductSchema = z.object({
    seller_name: optionalText(200),
    // Avatars can be long provider URLs; truncate like before instead of rejecting the listing.
    seller_avatar: z.string().transform(s => s.slice(0, 2000)).nullable().optional(),
    title: z.string().trim().min(1, 'Missing required fields (title, price)').max(200, 'Title or description too long'),
    description: z.string().max(5000, 'Title or description too long').nullable().optional(),
    price: z.coerce.number().finite().positive('Price must be a positive number').max(PRODUCT_MAX_PRICE, 'Price must be a positive number'),
    currency: optionalText(10),
    images: z.array(z.string().max(2000)).max(PRODUCT_MAX_IMAGES, `Images must be an array of at most ${PRODUCT_MAX_IMAGES} URLs`).optional(),
    category: optionalText(100),
    subcategory: optionalText(100),
    source_language: z.enum(PRODUCT_LANGUAGES).nullable().optional(),
    delivery_type: z.enum(PRODUCT_DELIVERY_TYPES).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    location_name: optionalText(300),
    country: optionalText(100),
    city: optionalText(200),
    town: optionalText(200),
    district: optionalText(200),
    location_display_name: optionalText(500),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const PRODUCTS_DEFAULT_LIMIT = 50;
export const PRODUCTS_MAX_LIMIT = 200;

/**
 * Query for GET /api/products. Missing `limit` → 50, unparsable `limit` → 20 (historical behaviour,
 * kept so existing clients page the same way); capped. `status=all` disables the status filter.
 */
export const ListProductsQuerySchema = z.object({
    limit: z.preprocess(
        v => (v === undefined ? PRODUCTS_DEFAULT_LIMIT : Math.min(parseInt(String(v), 10) || 20, PRODUCTS_MAX_LIMIT)),
        z.number().int().min(1),
    ),
    offset: z.preprocess(v => Math.max(parseInt(String(v), 10) || 0, 0), z.number().int()),
    status: z.string().max(50).optional(),
    seller_id: z.string().uuid().optional(),
    category: z.string().max(60).optional(),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

/** Body of POST /api/analyze — a (data-URL or raw) base64 JPEG plus the UI language for the generated copy. */
export const AnalyzeImageSchema = z.object({
    image: z.string().min(1, 'Image data is required').max(15_000_000),
    language: z.enum(PRODUCT_LANGUAGES).optional().catch(undefined),
});
export type AnalyzeImageInput = z.infer<typeof AnalyzeImageSchema>;

export const ProductIdParamSchema = z.object({ id: z.string().uuid() });

/** Seller-side status changes: mark sold, or relist (goes back through review). */
export const UpdateOwnProductStatusSchema = z.object({
    status: z.enum(['sold', 'active']),
});
export type UpdateOwnProductStatusInput = z.infer<typeof UpdateOwnProductStatusSchema>;
