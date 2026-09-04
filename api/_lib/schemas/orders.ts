import { z } from 'zod';
import { ORDER_TYPES, PAYMENT_METHODS } from '../domain/orders.js';

/** Client-input schemas for the order lifecycle endpoints (validated at the edge via parseBody/parseParams). */

export const UuidParamSchema = z.object({ id: z.string().uuid() });

export const CreateOrderSchema = z
    .object({
        productId: z.string().uuid(),
        orderType: z.enum(ORDER_TYPES),
        paymentMethod: z.enum(PAYMENT_METHODS),
        shippingAddress: z.object({}).passthrough().optional(),
        meetupLocation: z.string().max(300).optional(),
        meetupTime: z.string().optional(),
    })
    .superRefine((body, ctx) => {
        if (body.orderType === 'shipping' && !body.shippingAddress) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['shippingAddress'],
                message: 'Shipping address is required for shipping orders',
            });
        }
    });
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const ArrangeMeetupSchema = z.object({
    location: z.string().trim().min(1).max(300),
    time: z.string().nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
});
export type ArrangeMeetupInput = z.infer<typeof ArrangeMeetupSchema>;

export const CancelOrderSchema = z.object({
    reason: z.string().max(500).optional(),
});

export const ShipOrderSchema = z.object({
    orderId: z.string().uuid(),
    carrier: z.string().max(100).optional(),
    trackingNumber: z.string().max(100).optional(),
});

export const ConfirmOrderSchema = z.object({
    orderId: z.string().uuid(),
});

export const CreateDisputeSchema = z.object({
    orderId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
    description: z.string().max(2000).optional(),
});

export const ORDERS_DEFAULT_LIMIT = 50;
export const ORDERS_MAX_LIMIT = 200;

/**
 * Query for GET /api/orders. Garbage / missing paging values fall back to the defaults
 * rather than failing the request (matches the previous lenient parsing); limit is capped.
 */
export const ListOrdersQuerySchema = z.object({
    role: z.enum(['buyer', 'seller']).optional().catch(undefined),
    limit: z.coerce.number().int().min(1).catch(ORDERS_DEFAULT_LIMIT).transform(n => Math.min(n, ORDERS_MAX_LIMIT)),
    offset: z.coerce.number().int().min(0).catch(0),
});
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
