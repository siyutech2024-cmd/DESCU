import type { Express } from 'express';
import { productsRouter } from './products.js';
import { chatRouter } from './chat.js';
import { ordersRouter } from './orders.js';
import { stripeRouter } from './stripe.js';
import { usersRouter } from './users.js';
import { adminRouter } from './admin.js';
import { cronRouter } from './cron.js';
import { seoLocationRouter } from './seoLocation.js';
import { ratingsRouter } from './ratings.js';
import { negotiationsRouter } from './negotiations.js';
import { systemRouter } from './system.js';
import { moderationRouter } from './moderation.js';

/**
 * Mount every feature router. Order matters only where paths overlap:
 * ordersRouter must precede anything else matching /api/orders/*.
 */
export const registerRoutes = (app: Express): void => {
    app.use(productsRouter);
    app.use(chatRouter);
    app.use(ordersRouter);
    app.use(stripeRouter);
    app.use(usersRouter);
    app.use(adminRouter);
    app.use(cronRouter);
    app.use(seoLocationRouter);
    app.use(ratingsRouter);
    app.use(negotiationsRouter);
    app.use(moderationRouter);
    app.use(systemRouter);
};
