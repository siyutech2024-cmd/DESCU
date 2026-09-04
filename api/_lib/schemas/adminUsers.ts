import { z } from 'zod';
import { adminPaginationFields, optionalFilter } from './adminGeneral.js';

/** Client-input schemas for /api/admin/users/* (adminUserController.ts). */

export const ADMIN_USER_SORTS = ['created_at', 'product_count'] as const;

export const AdminUsersQuerySchema = z.object({
    ...adminPaginationFields(20),
    search: optionalFilter(200),
    is_verified: optionalFilter(10),
    sort_by: z.enum(ADMIN_USER_SORTS).catch('created_at'),
    sort_order: z.enum(['asc', 'desc']).catch('desc'),
    start_date: optionalFilter(40),
    end_date: optionalFilter(40),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

export const UpdateUserVerificationSchema = z.object({
    is_verified: z.boolean(),
});

/** Shared by DELETE /api/admin/users/:id, /conversations/:id and /messages/:id. */
export const HardDeleteSchema = z.object({
    hard_delete: z.boolean().default(false),
});
