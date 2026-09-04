process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

import { db, FakeQuery, resetDb as resetTables, type Row } from './helpers/fakeSupabase';

jest.mock('../db/supabase', () => ({ supabase: require('./helpers/fakeSupabase').fakeSupabase }));
jest.mock('../services/orderNotificationService', () => ({ notifyOrderStatus: jest.fn().mockResolvedValue(undefined) }));

import { processStripeEvent } from '../services/stripeWebhookService';

const ORDER = 'order-1';
const resetDb = () => resetTables({
    orders: [{ id: ORDER, status: 'pending_payment', total_amount: 100, payment_captured: null, product_id: 'prod-1' }],
    products: [{ id: 'prod-1', status: 'active' }],
    order_timeline: [],
    stripe_events: [],
});

const checkoutEvent = (id: string, overrides: Partial<Row> = {}) => ({
    id, type: 'checkout.session.completed', created: 1_700_000_000,
    data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 10000, payment_intent: 'pi_1', metadata: { order_id: ORDER, escrow: 'true', platform_fee: '500' }, ...overrides } },
}) as any;

describe('Stripe webhook processing', () => {
    beforeEach(resetDb);

    it('moves an awaiting order to escrow_held exactly once, even when the same event is delivered twice', async () => {
        expect(await processStripeEvent(checkoutEvent('evt_1'), 'test')).toBe('processed');
        expect(await processStripeEvent(checkoutEvent('evt_1'), 'test')).toBe('duplicate');
        const order = db.orders[0];
        expect(order.status).toBe('escrow_held');
        expect(order.payment_captured).toBe(true);
        expect(order.stripe_payment_intent_id).toBe('pi_1');
        expect(order.platform_fee).toBe(5);
        expect(db.products[0].status).toBe('sold');
        expect(db.order_timeline.filter(t => t.event_type === 'escrow_payment_received')).toHaveLength(1);
    });

    it('does not regress a completed order when a late payment_intent.succeeded arrives', async () => {
        db.orders[0].status = 'completed';
        db.orders[0].payment_captured = true;
        const evt = { id: 'evt_2', type: 'payment_intent.succeeded', created: 1, data: { object: { id: 'pi_1', amount_received: 10000, metadata: { order_id: ORDER } } } } as any;
        expect(await processStripeEvent(evt, 'test')).toBe('processed');
        expect(db.orders[0].status).toBe('completed');
    });

    it('ignores checkout.session.completed while an OXXO payment is still unpaid, then books the async success', async () => {
        expect(await processStripeEvent(checkoutEvent('evt_3', { payment_status: 'unpaid' }), 'test')).toBe('processed');
        expect(db.orders[0].status).toBe('pending_payment');
        const success = { ...checkoutEvent('evt_4'), type: 'checkout.session.async_payment_succeeded' };
        expect(await processStripeEvent(success, 'test')).toBe('processed');
        expect(db.orders[0].status).toBe('escrow_held');
    });

    it('refuses to mark an order paid when Stripe reports less than the order total', async () => {
        expect(await processStripeEvent(checkoutEvent('evt_5', { amount_total: 9000 }), 'test')).toBe('processed');
        expect(db.orders[0].status).toBe('pending_payment');
        expect(db.order_timeline.map(t => t.event_type)).toContain('payment_amount_mismatch');
    });

    it('records an orphaned payment when money arrives for an order that stopped waiting', async () => {
        db.orders[0].status = 'cancelled';
        await processStripeEvent(checkoutEvent('evt_6'), 'test');
        expect(db.orders[0].status).toBe('cancelled');
        expect(db.order_timeline.map(t => t.event_type)).toContain('payment_orphaned');
    });

    it('releases the event claim when the handler throws so a retry is processed', async () => {
        const evt = checkoutEvent('evt_7');
        // First delivery: make the orders read blow up once.
        const original = FakeQuery.prototype.maybeSingle;
        let failures = 0;
        FakeQuery.prototype.maybeSingle = function (this: any) {
            if (failures++ === 0) return Promise.reject(new Error('transient db error'));
            return original.call(this);
        };
        await expect(processStripeEvent(evt, 'test')).rejects.toThrow('transient db error');
        expect(db.stripe_events).toHaveLength(0);
        FakeQuery.prototype.maybeSingle = original;
        // Stripe retries: now it is processed, not treated as a duplicate.
        expect(await processStripeEvent(evt, 'test')).toBe('processed');
        expect(db.orders[0].status).toBe('escrow_held');
    });
});
