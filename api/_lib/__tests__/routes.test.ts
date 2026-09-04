/**
 * Route-table regression test.
 * Guards against accidentally dropping an endpoint while moving routes between
 * feature routers. Update EXPECTED_ROUTES deliberately when the API changes.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

import { createApp } from '../app';

type Route = { method: string; path: string };

const collectRoutes = (app: any): Route[] => {
    const routes: Route[] = [];
    const walk = (stack: any[]) => {
        for (const layer of stack) {
            if (layer.route) {
                for (const method of Object.keys(layer.route.methods)) {
                    routes.push({ method: method.toUpperCase(), path: layer.route.path });
                }
            } else if (layer.name === 'router' && layer.handle?.stack) {
                walk(layer.handle.stack);
            }
        }
    };
    walk(app._router?.stack ?? app.router?.stack ?? []);
    return routes;
};

const EXPECTED_ROUTES = [
    'GET /', 'GET /api/health',
    'POST /api/analyze', 'GET /api/products', 'POST /api/products', 'GET /api/products/:id', 'PATCH /api/products/:id/status',
    'POST /api/conversations', 'DELETE /api/conversations/:conversationId',
    'GET /api/users/:userId/conversations', 'POST /api/messages', 'GET /api/messages/:conversationId', 'PUT /api/messages/:conversationId/read',
    'GET /api/orders', 'POST /api/orders/create', 'GET /api/orders/:id', 'POST /api/orders/:id/confirm', 'POST /api/orders/:id/arrange-meetup', 'POST /api/orders/:id/cancel',
    'POST /api/orders/ship', 'POST /api/orders/confirm', 'POST /api/disputes',
    'POST /api/payment/webhook',
    'POST /api/stripe/v2/create-account', 'GET /api/stripe/v2/account-status', 'GET /api/stripe/v2/dashboard-link', 'POST /api/stripe/v2/webhook',
    'POST /api/stripe/create-payment-intent', 'POST /api/stripe/confirm-payment',
    'GET /api/users/:userId/credit', 'GET /api/users/payouts', 'POST /api/users/update-location', 'GET /api/users/bank-info', 'POST /api/users/bank-info',
    'GET /api/users/addresses', 'POST /api/users/addresses', 'PUT /api/users/addresses/:id', 'DELETE /api/users/addresses/:id',
    'POST /api/users/me', 'GET /api/users/favorites', 'POST /api/users/favorites/:productId/toggle', 'GET /api/users/:userId',
    'POST /api/negotiations/propose', 'POST /api/negotiations/:id/respond', 'GET /api/negotiations/product/:productId',
    'POST /api/ratings', 'GET /api/ratings/:userId/stats',
    'POST /api/reports', 'GET /api/blocks', 'POST /api/blocks', 'DELETE /api/blocks/:userId',
    'GET /api/location/reverse', 'GET /api/location/ip',
    'GET /api/cron/auto-review', 'POST /api/cron/auto-review', 'GET /api/cron/expire-orders', 'POST /api/cron/expire-orders',
    'GET /api/admin/dashboard/stats', 'GET /api/admin/auth/me', 'GET /api/admin/logs', 'GET /api/admin/orders', 'POST /api/admin/orders/:id/mark-paid',
    'GET /api/admin/disputes', 'POST /api/admin/disputes/resolve',
    'GET /api/admin/products', 'GET /api/admin/products/:id', 'PUT /api/admin/products/:id', 'DELETE /api/admin/products/:id',
    'POST /api/admin/products/:id/restore', 'PATCH /api/admin/products/:id/status', 'PATCH /api/admin/products/:id/promote', 'POST /api/admin/products/batch',
    'GET /api/admin/users', 'GET /api/admin/users/:id', 'PATCH /api/admin/users/:id/verify', 'DELETE /api/admin/users/:id',
    'GET /api/admin/conversations', 'GET /api/admin/conversations/:id', 'POST /api/admin/conversations/:id/messages', 'DELETE /api/admin/conversations/:id', 'DELETE /api/admin/messages/:id', 'PATCH /api/admin/messages/:id/flag',
    'GET /api/admin/reports', 'GET /api/admin/settings', 'PUT /api/admin/settings', 'POST /api/admin/settings/batch',
    'POST /api/admin/trigger-review', 'GET /api/admin/ai-status', 'POST /api/admin/batch-translate',
    'GET /api/admin/payouts', 'POST /api/admin/payouts/:orderId/complete', 'POST /api/admin/payouts/:orderId/processing',
];

/** Endpoints deliberately removed; they must not silently come back. */
const REMOVED_ROUTES = [
    'GET /api/test_ping', 'GET /api/products/health', 'GET /api/orders/health',
    'GET /sitemap.xml', 'GET /llms-full.txt',
    'GET /api/conversations/:conversationId/messages',
    'POST /api/payment/create-intent', 'POST /api/payment/verify', 'POST /api/payment/bank-info', 'POST /api/payment/connect', 'GET /api/payment/dashboard/:userId',
    'POST /api/stripe/add-bank-account', 'GET /api/stripe/account-status', 'POST /api/stripe/create-express-account', 'GET /api/stripe/express-status',
    'POST /api/stripe/v2/checkout-session', 'POST /api/stripe/v2/account-link',
    'GET /api/stripe/seller-balance', 'POST /api/stripe/seller-payout', 'GET /api/stripe/seller-payouts',
];

describe('API route table', () => {
    const app = createApp();
    const registered = new Set(collectRoutes(app).map(r => `${r.method} ${r.path}`));

    it('registers every expected endpoint', () => {
        const missing = EXPECTED_ROUTES.filter(r => !registered.has(r));
        expect(missing).toEqual([]);
    });

    it('has no unexpected endpoints', () => {
        const expected = new Set(EXPECTED_ROUTES);
        const extra = [...registered].filter(r => !expected.has(r));
        expect(extra).toEqual([]);
    });

    it('does not re-register a deliberately removed endpoint', () => {
        const resurrected = REMOVED_ROUTES.filter(r => registered.has(r));
        expect(resurrected).toEqual([]);
    });

    it('serves GET /api/orders before any /api/orders/:id matcher steals it', () => {
        const routes = collectRoutes(app);
        const list = routes.findIndex(r => r.method === 'GET' && r.path === '/api/orders');
        const byId = routes.findIndex(r => r.method === 'GET' && r.path === '/api/orders/:id');
        expect(list).toBeGreaterThanOrEqual(0);
        expect(list).toBeLessThan(byId);
    });
});
