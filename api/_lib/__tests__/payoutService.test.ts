process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

import { db, resetDb, type Row } from './helpers/fakeSupabase';

jest.mock('../db/supabase', () => ({ supabase: require('./helpers/fakeSupabase').fakeSupabase }));

import { listPayouts, completeManualPayout, markOrderPayoutProcessing } from '../services/payoutService';

// Relations are attached by batched lookups (orders.seller_id has no PostgREST relationship to public.users).
const order = (overrides: Partial<Row>): Row => ({
    id: 'order-x', seller_id: 'seller-1', buyer_id: 'buyer-1', product_id: 'p', payment_method: 'online', payment_captured: true,
    total_amount: 105, platform_fee: 5, payout_status: 'pending', completed_at: '2026-01-01T00:00:00Z', ...overrides,
});

const seed = () => resetDb({
    orders: [
        // Real manual-payout queue: seller has no Connect account / transfer failed.
        order({ id: 'queue-1', status: 'completed_pending_payout', payout_status: null, transferred_to_seller: false, completed_at: '2026-01-02T00:00:00Z' }),
        order({ id: 'queue-2', status: 'completed_pending_payout', payout_status: 'pending', transferred_to_seller: null, completed_at: '2026-01-01T00:00:00Z' }),
        order({ id: 'queue-3', status: 'completed_pending_payout', payout_status: 'processing', transferred_to_seller: false }),
        // Stripe already moved the money: must never be shown as "to pay".
        order({ id: 'stripe-1', status: 'completed', payout_status: 'pending', transferred_to_seller: true, stripe_transfer_id: 'tr_1' }),
        order({ id: 'stripe-2', status: 'completed', payout_status: null, transferred_to_seller: true }),
        // Previously paid manually.
        order({ id: 'done-1', status: 'completed', payout_status: 'completed', transferred_to_seller: true, payout_reference: 'SPEI-1' }),
        // Not finished / cash: not in the queue at all.
        order({ id: 'live-1', status: 'escrow_held', payout_status: 'pending', transferred_to_seller: false }),
        order({ id: 'cash-1', status: 'completed', payment_method: 'cash', payout_status: 'pending', transferred_to_seller: false }),
    ],
    order_timeline: [],
    products: [{ id: 'p', title: 'Bike', images: [] }],
    users: [{ id: 'seller-1', name: 'Ana', email: 'ana@example.com' }],
    sellers: [{ user_id: 'seller-1', bank_clabe: '0123', bank_name: 'BBVA', bank_holder_name: 'Ana' }],
});

describe('payoutService legacy rows (finalised before escrowReleaseService existed)', () => {
    beforeEach(() => {
        seed();
        db.orders.push(
            // completed online order that was never transferred nor paid manually → still owed
            order({ id: 'legacy-1', status: 'completed', payout_status: 'pending', transferred_to_seller: null, completed_at: '2025-12-01T00:00:00Z' }),
            order({ id: 'legacy-2', status: 'delivered', payout_status: null, transferred_to_seller: false, completed_at: '2025-12-02T00:00:00Z' }),
        );
    });

    it('lists legacy completed-but-unpaid online orders in the pending queue', async () => {
        const { payouts, stats } = await listPayouts('pending');
        expect(payouts.map(p => p.id)).toEqual(['legacy-1', 'legacy-2', 'queue-2', 'queue-1']);
        expect(stats.pending).toBe(4);
        expect(payouts.map(p => p.id)).not.toContain('stripe-1');
        expect(payouts.map(p => p.id)).not.toContain('cash-1');
    });

    it('can pay a legacy row exactly once', async () => {
        expect((await completeManualPayout({ orderId: 'legacy-1', adminId: 'a', reference: 'SPEI-9' })).ok).toBe(true);
        const row = db.orders.find(o => o.id === 'legacy-1')!;
        expect(row.transferred_to_seller).toBe(true);
        expect(row.payout_status).toBe('completed');
        const again = await completeManualPayout({ orderId: 'legacy-1', adminId: 'a' });
        expect(again).toMatchObject({ ok: false, code: 409 });
        expect((await listPayouts('pending')).payouts.map(p => p.id)).not.toContain('legacy-1');
    });

    it('a completed payout is terminal: processing cannot reopen it', async () => {
        const r = await markOrderPayoutProcessing('done-1');
        expect(r).toMatchObject({ ok: false, code: 409 });
        expect(db.orders.find(o => o.id === 'done-1')!.payout_status).toBe('completed');
    });
});

describe('payoutService.listPayouts', () => {
    beforeEach(seed);

    it('pending queue is exactly the completed_pending_payout orders not yet picked up, oldest first', async () => {
        const { payouts, stats } = await listPayouts('pending');
        expect(payouts.map(p => p.id)).toEqual(['queue-2', 'queue-1']);
        expect(payouts.map(p => p.id)).not.toContain('stripe-1');
        expect(payouts.map(p => p.id)).not.toContain('stripe-2');
        expect(stats).toEqual({ pending: 2, processing: 1, completed: 1, totalPendingAmount: 200 });
    });

    it('pays out total minus the recorded platform fee, and exposes the seller bank row', async () => {
        const { payouts } = await listPayouts('pending');
        expect(payouts[0].payoutAmount).toBe(100);
        expect(payouts[0].sellerBank).toEqual({ user_id: 'seller-1', bank_clabe: '0123', bank_name: 'BBVA', bank_holder_name: 'Ana' });
        expect(payouts[0].seller).toMatchObject({ id: 'seller-1', name: 'Ana' });
        expect(payouts[0].products).toMatchObject({ title: 'Bike' });
    });

    it('falls back to the standard commission when the row has no platform_fee', async () => {
        db.orders.find(o => o.id === 'queue-1')!.platform_fee = null;
        const { payouts } = await listPayouts('pending');
        expect(payouts.find(p => p.id === 'queue-1')!.payoutAmount).toBeCloseTo(99.75, 2);
    });

    it('processing / completed / all slices share the same stats', async () => {
        const processing = await listPayouts('processing');
        expect(processing.payouts.map(p => p.id)).toEqual(['queue-3']);
        const completed = await listPayouts('completed');
        expect(completed.payouts.map(p => p.id)).toEqual(['done-1']);
        const all = await listPayouts('all');
        expect(all.payouts.map(p => p.id).sort()).toEqual(['done-1', 'queue-1', 'queue-2', 'queue-3']);
        expect(processing.stats).toEqual(all.stats);
        expect(completed.stats).toEqual(all.stats);
    });

    it('treats an unknown status as pending', async () => {
        const { payouts } = await listPayouts('bogus');
        expect(payouts.map(p => p.id)).toEqual(['queue-2', 'queue-1']);
    });
});

describe('payoutService.completeManualPayout', () => {
    beforeEach(seed);

    it('moves the order to completed, marks the funds transferred and records the timeline once', async () => {
        const result = await completeManualPayout({ orderId: 'queue-1', adminId: 'admin-1', reference: 'SPEI-42', notes: 'sent today' });
        expect(result.ok).toBe(true);

        const row = db.orders.find(o => o.id === 'queue-1')!;
        expect(row.status).toBe('completed');
        expect(row.transferred_to_seller).toBe(true);
        expect(row.escrow_status).toBe('released');
        expect(row.payout_status).toBe('completed');
        expect(row.payout_reference).toBe('SPEI-42');
        expect(row.payout_at).toBeTruthy();
        expect(row.completed_at).toBe('2026-01-02T00:00:00Z'); // already set: untouched

        const events = db.order_timeline.filter(t => t.order_id === 'queue-1');
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            event_type: 'manual_payout_completed', created_by: 'admin-1',
            metadata: { reference: 'SPEI-42', notes: 'sent today' },
        });

        // It left the pending queue and shows up under completed.
        const { payouts, stats } = await listPayouts('pending');
        expect(payouts.map(p => p.id)).toEqual(['queue-2']);
        expect(stats.completed).toBe(2);
    });

    it('generates a MANUAL-<ts> reference and stamps completed_at when missing', async () => {
        db.orders.find(o => o.id === 'queue-2')!.completed_at = null;
        const result = await completeManualPayout({ orderId: 'queue-2', adminId: null });
        expect(result.ok).toBe(true);
        const row = db.orders.find(o => o.id === 'queue-2')!;
        expect(row.payout_reference).toMatch(/^MANUAL-\d+$/);
        expect(row.completed_at).toBeTruthy();
    });

    it('returns 409 on a second completion of the same order', async () => {
        expect((await completeManualPayout({ orderId: 'queue-1', adminId: 'admin-1', reference: 'A' })).ok).toBe(true);
        const second = await completeManualPayout({ orderId: 'queue-1', adminId: 'admin-1', reference: 'B' });
        expect(second).toMatchObject({ ok: false, code: 409 });
        expect(db.orders.find(o => o.id === 'queue-1')!.payout_reference).toBe('A');
        expect(db.order_timeline.filter(t => t.order_id === 'queue-1')).toHaveLength(1);
    });

    it('refuses an order whose money Stripe already transferred', async () => {
        const result = await completeManualPayout({ orderId: 'stripe-1', adminId: 'admin-1' });
        expect(result).toMatchObject({ ok: false, code: 409 });
        expect(db.orders.find(o => o.id === 'stripe-1')!.payout_status).toBe('pending');
        expect(db.order_timeline).toHaveLength(0);
    });

    it('refuses an order that is not awaiting manual payout, and 404s an unknown one', async () => {
        expect(await completeManualPayout({ orderId: 'live-1', adminId: 'admin-1' })).toMatchObject({ ok: false, code: 409 });
        expect(await completeManualPayout({ orderId: 'nope', adminId: 'admin-1' })).toMatchObject({ ok: false, code: 404 });
    });

    it('does not touch escrow_status for a non-online order', async () => {
        db.orders.push(order({ id: 'legacy-1', status: 'completed_pending_payout', payment_method: 'cash', escrow_status: null, transferred_to_seller: false }));
        expect((await completeManualPayout({ orderId: 'legacy-1', adminId: 'admin-1' })).ok).toBe(true);
        expect(db.orders.find(o => o.id === 'legacy-1')!.escrow_status).toBeNull();
    });
});

describe('payoutService.markOrderPayoutProcessing', () => {
    beforeEach(seed);

    it('flags a queued order as processing and moves it between slices', async () => {
        expect((await markOrderPayoutProcessing('queue-1')).ok).toBe(true);
        const { payouts, stats } = await listPayouts('processing');
        expect(payouts.map(p => p.id).sort()).toEqual(['queue-1', 'queue-3']);
        expect(stats.pending).toBe(1);
    });

    it('refuses orders outside the queue', async () => {
        expect(await markOrderPayoutProcessing('stripe-1')).toMatchObject({ ok: false, code: 409 });
        expect(await markOrderPayoutProcessing('done-1')).toMatchObject({ ok: false, code: 409 });
        expect(db.orders.find(o => o.id === 'stripe-1')!.payout_status).toBe('pending');
    });
});
