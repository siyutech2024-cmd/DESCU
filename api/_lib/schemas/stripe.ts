import { z } from 'zod';

/** Client-input schemas for the in-app card payment endpoints. */

export const CreatePaymentIntentSchema = z.object({
    orderId: z.string().uuid(),
});

export const ConfirmPaymentSchema = z.object({
    orderId: z.string().uuid(),
    paymentIntentId: z.string().regex(/^pi_/, 'paymentIntentId must be a Stripe PaymentIntent id'),
});
