import { z } from 'zod';
import { adminPaginationFields, optionalFilter } from './adminGeneral.js';

/** Client-input schemas for /api/admin/products/* (adminProductController.ts). */

export const ADMIN_PRODUCT_STATUSES = ['active', 'inactive', 'pending_review'] as const;
export const ADMIN_PRODUCT_SORTS = ['created_at', 'price', 'views'] as const;

const sortOrder = z.enum(['asc', 'desc']);

export const AdminProductsQuerySchema = z.object({
    ...adminPaginationFields(20),
    search: optionalFilter(200),
    category: optionalFilter(100),
    status: optionalFilter(50),
    is_promoted: optionalFilter(10),
    seller_id: z.string().uuid().optional(),
    // `sort`/`order` are current; `sort_by`/`sort_order` are the legacy names — the handler picks the first present.
    sort: z.enum(ADMIN_PRODUCT_SORTS).optional().catch(undefined),
    order: sortOrder.optional().catch(undefined),
    sort_by: z.enum(ADMIN_PRODUCT_SORTS).optional().catch(undefined),
    sort_order: sortOrder.optional().catch(undefined),
    include_deleted: z.string().max(10).default('false'),
    minPrice: z.coerce.number().min(0).optional().catch(undefined),
    maxPrice: z.coerce.number().min(0).optional().catch(undefined),
    startDate: optionalFilter(40),
    endDate: optionalFilter(40),
    promotedOnly: optionalFilter(10),
});
export type AdminProductsQuery = z.infer<typeof AdminProductsQuerySchema>;

/**
 * PUT /api/admin/products/:id — the edit modal sends an arbitrary subset of product columns.
 * Identity columns are never writable through this endpoint.
 */
export const UpdateAdminProductSchema = z
    .record(z.unknown())
    .transform(({ id: _id, seller_id: _sellerId, created_at: _createdAt, ...rest }) => rest);

export const UpdateProductStatusSchema = z.object({
    status: z.enum(ADMIN_PRODUCT_STATUSES),
});

export const UpdateProductPromotionSchema = z.object({
    is_promoted: z.boolean(),
});

export const BATCH_ACTIONS = ['delete', 'activate', 'deactivate', 'promote', 'unpromote', 'custom'] as const;

const idList = z.array(z.string().uuid()).min(1).max(500);

/**
 * POST /api/admin/products/batch. Two accepted shapes:
 *   new:    { productIds, updates }            (updates restricted to BATCH_UPDATABLE_COLUMNS in the handler)
 *   legacy: { product_ids, action, data? }
 */
export const BatchUpdateProductsSchema = z.object({
    productIds: idList.optional(),
    product_ids: idList.optional(),
    updates: z.record(z.unknown()).optional(),
    action: z.enum(BATCH_ACTIONS).optional().catch(undefined),
    data: z.record(z.unknown()).optional(),
});
export type BatchUpdateProductsInput = z.infer<typeof BatchUpdateProductsSchema>;
