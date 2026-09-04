process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

import { db, resetDb } from './helpers/fakeSupabase';

jest.mock('../db/supabase', () => ({ supabase: require('./helpers/fakeSupabase').fakeSupabase }));

import {
    ORDER_STATUSES,
    ORDER_TRANSITIONS,
    TERMINAL_STATUSES,
    canTransition,
    cancelBlockReason,
    initialOrderStatus,
} from '../domain/orderStatus';
import { cancelOrder, expireUnpaidOrders, transitionOrder } from '../services/orderTransitionService';

const BUYER = 'buyer-1';
const SELLER = 'seller-1';
const order = (overrides: Record<string, any> = {}) => ({
    id: 'order-1', status: 'pending_payment', buyer_id: BUYER, seller_id: SELLER, product_id: 'prod-1',
    payment_method: 'online', payment_captured: null, expires_at: '2026-01-01T00:00:00.000Z', ...overrides,
});

describe('order state graph', () => {
    it('every status has an entry and terminal statuses have no exits', () => {
        for (const s of ORDER_STATUSES) expect(Array.isArray(ORDER_TRANSITIONS[s])).toBe(true);
        for (const s of TERMINAL_STATUSES) expect(ORDER_TRANSITIONS[s]).toEqual([]);
    });

    it('nothing leads to delivered any more (dead state) and paid orders cannot regress', () => {
        for (const s of ORDER_STATUSES) expect(canTransition(s, 'delivered')).toBe(false);
        expect(canTransition('escrow_held', 'pending_payment')).toBe(false);
        expect(canTransition('completed', 'disputed')).toBe(false);
        expect(canTransition('shipped', 'meetup_arranged')).toBe(false);
    });

    it('describes the happy paths', () => {
        expect(initialOrderStatus('cash')).toBe('paid');
        expect(initialOrderStatus('online')).toBe('pending_payment');
        expect(canTransition('pending_payment', 'escrow_held')).toBe(true);
        expect(canTransition('escrow_held', 'shipped')).toBe(true);
        expect(canTransition('shipped', 'completed_pending_payout')).toBe(true);
        expect(canTransition('completed_pending_payout', 'completed')).toBe(true);
        expect(canTransition('disputed', 'refunded')).toBe(true);
        expect(canTransition('meetup_arranged', 'meetup_arranged')).toBe(true);
    });

    it('cancel rules: buyer cancels unpaid online orders, either party cancels unfinished cash orders', () => {
        expect(cancelBlockReason(order(), BUYER)).toBeNull();
        expect(cancelBlockReason(order(), SELLER)).toMatch(/Only the buyer/);
        expect(cancelBlockReason(order(), 'stranger')).toMatch(/Not authorized/);
        expect(cancelBlockReason(order({ status: 'escrow_held', payment_captured: true }), BUYER)).toMatch(/dispute/);
        expect(cancelBlockReason(order({ status: 'paid', payment_method: 'cash' }), SELLER)).toBeNull();
        expect(cancelBlockReason(order({ status: 'meetup_arranged', payment_method: 'cash' }), BUYER)).toBeNull();
        expect(cancelBlockReason(order({ status: 'completed', payment_method: 'cash' }), BUYER)).toMatch(/cannot be cancelled/);
    });
});

describe('transitionOrder', () => {
    beforeEach(() => resetDb({ orders: [order()], order_timeline: [], products: [{ id: 'prod-1', status: 'active' }] }));

    it('rejects an illegal edge before touching the database', async () => {
        const out = await transitionOrder({ orderId: 'order-1', from: 'pending_payment', to: 'shipped' });
        expect(out).toMatchObject({ ok: false, code: 400 });
        expect(db.orders[0].status).toBe('pending_payment');
    });

    it('applies the patch and timeline only when the row is still in the expected status', async () => {
        const out = await transitionOrder({
            orderId: 'order-1', from: ['pending_payment', 'meetup_arranged'], to: 'escrow_held',
            patch: { payment_captured: true }, timeline: { event_type: 'escrow_payment_received', description: 'paid' },
        });
        expect(out.ok).toBe(true);
        expect(db.orders[0]).toMatchObject({ status: 'escrow_held', payment_captured: true });
        expect(db.orders[0].updated_at).toBeDefined();
        expect(db.order_timeline).toHaveLength(1);

        const again = await transitionOrder({ orderId: 'order-1', from: 'pending_payment', to: 'escrow_held' });
        expect(again).toMatchObject({ ok: false, code: 409 });
        expect(db.order_timeline).toHaveLength(1);
    });

    it('honours extra where-conditions (e.g. a lock column)', async () => {
        db.orders[0].status = 'escrow_held';
        db.orders[0].confirmed_at = 'lock-A';
        const lost = await transitionOrder({ orderId: 'order-1', from: 'escrow_held', to: 'completed', where: q => q.eq('confirmed_at', 'lock-B') });
        expect(lost).toMatchObject({ ok: false, code: 409 });
        const won = await transitionOrder({ orderId: 'order-1', from: 'escrow_held', to: 'completed', where: q => q.eq('confirmed_at', 'lock-A') });
        expect(won.ok).toBe(true);
        expect(db.orders[0].status).toBe('completed');
    });
});

describe('cancelOrder', () => {
    beforeEach(() => resetDb({ orders: [order()], order_timeline: [], products: [{ id: 'prod-1', status: 'sold' }] }));

    it('lets the buyer cancel an unpaid order, records who did it and puts the product back on sale', async () => {
        const out = await cancelOrder({ order: db.orders[0] as any, actorId: BUYER, reason: 'changed my mind' });
        expect(out.ok).toBe(true);
        expect(db.orders[0].status).toBe('cancelled');
        expect(db.order_timeline[0]).toMatchObject({ event_type: 'cancelled', created_by: BUYER, metadata: { by: 'buyer', reason: 'changed my mind' } });
        expect(db.products[0].status).toBe('active');
    });

    it('refuses the seller on an unpaid online order and anyone on a captured payment', async () => {
        expect(await cancelOrder({ order: db.orders[0] as any, actorId: SELLER })).toMatchObject({ ok: false, code: 400 });
        db.orders[0].status = 'escrow_held';
        db.orders[0].payment_captured = true;
        expect(await cancelOrder({ order: db.orders[0] as any, actorId: BUYER })).toMatchObject({ ok: false, code: 400 });
        expect(await cancelOrder({ order: db.orders[0] as any, actorId: 'stranger' })).toMatchObject({ ok: false, code: 403 });
        expect(db.orders[0].status).toBe('escrow_held');
    });

    it('does not cancel underneath a payment that landed between the read and the write', async () => {
        const snapshot = { ...db.orders[0] } as any;
        db.orders[0].payment_captured = true; // webhook won the race
        expect(await cancelOrder({ order: snapshot, actorId: BUYER })).toMatchObject({ ok: false, code: 409 });
        expect(db.orders[0].status).toBe('pending_payment');
    });
});

describe('expireUnpaidOrders', () => {
    it('cancels only stale, unpaid, online pending_payment orders and reopens their products', async () => {
        const old = '2020-01-01T00:00:00.000Z';
        const future = '2999-01-01T00:00:00.000Z';
        resetDb({
            orders: [
                order({ id: 'stale', expires_at: old }),
                order({ id: 'fresh', expires_at: future }),
                order({ id: 'paid-late', expires_at: old, payment_captured: true }),
                order({ id: 'cash', expires_at: old, payment_method: 'cash', status: 'paid' }),
                order({ id: 'arranged', expires_at: old, status: 'meetup_arranged' }),
            ],
            order_timeline: [],
            products: [{ id: 'prod-1', status: 'sold' }],
        });
        const result = await expireUnpaidOrders();
        expect(result).toMatchObject({ scanned: 1, cancelled: 1, orderIds: ['stale'] });
        const byId = Object.fromEntries(db.orders.map(o => [o.id, o.status]));
        expect(byId).toEqual({ stale: 'cancelled', fresh: 'pending_payment', 'paid-late': 'pending_payment', cash: 'paid', arranged: 'meetup_arranged' });
        expect(db.order_timeline[0]).toMatchObject({ order_id: 'stale', event_type: 'cancelled', metadata: { reason: 'payment_expired' } });
        expect(db.products[0].status).toBe('active');
    });
});
