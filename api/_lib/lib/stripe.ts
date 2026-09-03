import Stripe from 'stripe';

/** Pinned API version shared by every Stripe call in the backend. */
export const STRIPE_API_VERSION = '2024-12-18.acacia';

let instance: Stripe | null = null;

/**
 * Lazily construct the shared Stripe client.
 * Throws a clear error at call time (not at import time) when the secret key
 * is missing, so the API can boot locally without Stripe configured.
 */
export const getStripe = (): Stripe => {
    if (!instance) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('Stripe not configured: set STRIPE_SECRET_KEY');
        }
        instance = new Stripe(key, { apiVersion: STRIPE_API_VERSION as any });
    }
    return instance;
};
