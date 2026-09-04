import { Router } from 'express';
import { requireAuth } from '../middleware/userAuth.js';
import { arrangeMeetup, cancelOrder, confirmOrderByParty, createOrder, getOrder } from '../controllers/orderController.js';
import { confirmOrder, createDispute, getUserOrders, markOrderAsShipped } from '../controllers/paymentController.js';

/**
 * Order lifecycle routes.
 *
 * NOTE: GET /api/orders is served by paymentController.getUserOrders (it was
 * registered first in the original monolith, so an inline duplicate that
 * followed it was unreachable and has been removed). The static /ship and
 * /confirm paths are registered before the /:id matchers on purpose.
 */
export const ordersRouter = Router();
const router = ordersRouter;

router.post('/api/orders/ship', requireAuth, markOrderAsShipped);
router.post('/api/orders/confirm', requireAuth, confirmOrder);
router.get('/api/orders', requireAuth, getUserOrders);
router.post('/api/disputes', requireAuth, createDispute);

router.post('/api/orders/create', requireAuth, createOrder);
router.get('/api/orders/:id', requireAuth, getOrder);
router.post('/api/orders/:id/confirm', requireAuth, confirmOrderByParty);
router.post('/api/orders/:id/arrange-meetup', requireAuth, arrangeMeetup);
router.post('/api/orders/:id/cancel', requireAuth, cancelOrder);
