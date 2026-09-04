import { Router } from 'express';
import { requireAuth } from '../middleware/userAuth.js';
import { handleStripeWebhook } from '../controllers/paymentController.js';
import {
    confirmPayment,
    createConnectAccount,
    createDashboardLink,
    createPaymentIntent,
    getConnectAccountStatus,
    handleStripeV2Webhook,
} from '../controllers/stripeController.js';

/**
 * Stripe routes.
 *  - POST /api/payment/webhook      legacy webhook URL (kept: Stripe may still be configured to it)
 *  - /api/stripe/v2/*               Express Connect onboarding + webhook
 *  - /api/stripe/create-payment-intent, /api/stripe/confirm-payment   in-app card payment
 * Webhooks carry no auth — they are verified by Stripe signature; raw-body parsing for
 * both webhook paths is configured in app.ts.
 */
export const stripeRouter = Router();
const router = stripeRouter;

router.post('/api/payment/webhook', handleStripeWebhook);

router.post('/api/stripe/v2/create-account', requireAuth, createConnectAccount);
router.get('/api/stripe/v2/account-status', requireAuth, getConnectAccountStatus);
router.get('/api/stripe/v2/dashboard-link', requireAuth, createDashboardLink);
router.post('/api/stripe/v2/webhook', handleStripeV2Webhook);

router.post('/api/stripe/create-payment-intent', requireAuth, createPaymentIntent);
router.post('/api/stripe/confirm-payment', requireAuth, confirmPayment);
