import { z } from 'zod';

/** Client-input schemas for /api/users/* (validated at the edge via parseBody/parseParams). */

export const UserIdParamSchema = z.object({ userId: z.string().uuid() });
export const AddressIdParamSchema = z.object({ id: z.string().uuid() });

/** Body of POST /api/users/update-location (from the IP-geolocation lookup on the client). */
export const UpdateLocationSchema = z.object({
    country: z.string().max(100).nullable().optional(),
    city: z.string().max(200).nullable().optional(),
    countryName: z.string().max(200).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
});
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;

/** Body of POST /api/users/bank-info — Mexican CLABE is always exactly 18 digits. */
export const BankInfoSchema = z.object({
    bankName: z.string().trim().min(1, 'Bank name is required').max(100),
    clabe: z.string().regex(/^\d{18}$/, 'CLABE must be 18 digits'),
    holderName: z.string().trim().min(1, 'Holder name is required').max(200),
});
export type BankInfoInput = z.infer<typeof BankInfoSchema>;

/** Columns of user_addresses a client may write. `user_id`, `id`, `created_at` are never accepted. */
const addressFields = {
    recipient_name: z.string().trim().min(1).max(200),
    phone_number: z.string().trim().min(1).max(50),
    street_address: z.string().trim().min(1).max(500),
    city: z.string().trim().min(1).max(200),
    state: z.string().trim().min(1).max(200),
    zip_code: z.string().trim().min(1).max(20),
    country: z.string().trim().min(1).max(10),
    is_default: z.boolean(),
};

export const CreateAddressSchema = z.object({
    ...addressFields,
    country: addressFields.country.default('MX'),
    is_default: addressFields.is_default.default(false),
});
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;

/** PUT body: any subset of the whitelisted columns; unknown keys are stripped. */
export const UpdateAddressSchema = z.object(addressFields).partial();
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
