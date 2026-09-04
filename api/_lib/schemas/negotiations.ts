import { z } from 'zod';

/** Client-input schemas for /api/negotiations/* (validated at the edge via parseBody/parseParams). */

export const NEGOTIATION_MAX_PRICE = 10_000_000;
export const NEGOTIATION_ACTIONS = ['accept', 'reject', 'counter'] as const;
export type NegotiationAction = (typeof NEGOTIATION_ACTIONS)[number];

const PriceSchema = z.number().positive().max(NEGOTIATION_MAX_PRICE);

export const NegotiationIdParamSchema = z.object({ id: z.string().uuid() });
export const ProductIdParamSchema = z.object({ productId: z.string().uuid() });

export const ProposeNegotiationSchema = z.object({
    conversationId: z.string().uuid(),
    productId: z.string().uuid(),
    proposedPrice: PriceSchema,
    /** Accepted for forward compatibility; not persisted today. */
    message: z.string().max(500).optional(),
});
export type ProposeNegotiationInput = z.infer<typeof ProposeNegotiationSchema>;

export const RespondNegotiationSchema = z
    .object({
        action: z.enum(NEGOTIATION_ACTIONS),
        counterPrice: PriceSchema.optional(),
        message: z.string().max(500).optional(),
    })
    .superRefine((body, ctx) => {
        if (body.action === 'counter' && body.counterPrice === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['counterPrice'],
                message: 'Counter price must be a positive number',
            });
        }
    });
export type RespondNegotiationInput = z.infer<typeof RespondNegotiationSchema>;
