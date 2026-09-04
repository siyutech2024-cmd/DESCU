process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

import { db, resetDb } from './helpers/fakeSupabase';

jest.mock('../db/supabase', () => ({ supabase: require('./helpers/fakeSupabase').fakeSupabase }));

import { closeCompetingOrders } from '../services/orderTransitionService';
import { acceptedOfferFor } from '../controllers/orderController';

const order = (overrides: Record<string, any>) => ({
    id: 'o', status: 'pending_payment', buyer_id: 'b', seller_id: 's', product_id: 'prod-1',
    payment_method: 'online', payment_captured: null, stripe_payment_intent_id: null, ...overrides,
});

describe('one item, one buyer — closeCompetingOrders', () => {
    beforeEach(() => resetDb({
        orders: [
            order({ id: 'winner', status: 'paid', payment_captured: true }),
            order({ id: 'unpaid-online', status: 'pending_payment', buyer_id: 'b2' }),
            order({ id: 'cash-intent', status: 'paid', payment_method: 'cash', buyer_id: 'b3' }),
            order({ id: 'cash-meetup', status: 'meetup_arranged', payment_method: 'cash', buyer_id: 'b4' }),
            // legacy paid online row: payment_captured null but money was taken — must be left alone
            order({ id: 'legacy-paid', status: 'paid', payment_method: 'online', payment_captured: null, buyer_id: 'b5' }),
            order({ id: 'other-product', status: 'pending_payment', product_id: 'prod-2', buyer_id: 'b6' }),
            order({ id: 'done', status: 'completed', buyer_id: 'b7' }),
        ],
        order_timeline: [],
    }));

    it('cancels unpaid online orders and cash intents on the same product only', async () => {
        const cancelled = await closeCompetingOrders('prod-1', 'winner', 'paid');
        expect(cancelled.sort()).toEqual(['cash-intent', 'cash-meetup', 'unpaid-online']);
        const byId = Object.fromEntries(db.orders.map(o => [o.id, o.status]));
        expect(byId.winner).toBe('paid');
        expect(byId['legacy-paid']).toBe('paid');
        expect(byId['other-product']).toBe('pending_payment');
        expect(byId.done).toBe('completed');
        expect(byId['unpaid-online']).toBe('cancelled');
        const reasons = db.order_timeline.map(t => t.metadata?.reason);
        expect(reasons.every(r => r === 'product_sold_elsewhere')).toBe(true);
        expect(db.order_timeline).toHaveLength(3);
    });

    it('is idempotent', async () => {
        await closeCompetingOrders('prod-1', 'winner');
        const again = await closeCompetingOrders('prod-1', 'winner');
        expect(again).toEqual([]);
    });
});

describe('accepted offers apply to the buyer who negotiated them', () => {
    const recent = new Date(Date.now() - 86400_000).toISOString();
    const stale = new Date(Date.now() - 10 * 86400_000).toISOString();
    beforeEach(() => resetDb({
        price_negotiations: [
            { id: 'n-old', product_id: 'prod-1', buyer_id: 'b', status: 'accepted', offered_price: 200, responded_at: stale },
            { id: 'n-new', product_id: 'prod-1', buyer_id: 'b', status: 'accepted', offered_price: 240, responded_at: recent },
            { id: 'n-pending', product_id: 'prod-1', buyer_id: 'b', status: 'pending', offered_price: 100, responded_at: null },
            { id: 'n-other-buyer', product_id: 'prod-1', buyer_id: 'b2', status: 'accepted', offered_price: 50, responded_at: recent },
            { id: 'n-rejected', product_id: 'prod-1', buyer_id: 'b3', status: 'rejected', offered_price: 10, responded_at: recent },
        ],
    }));

    it('returns the newest valid accepted offer for that buyer', async () => {
        expect(await acceptedOfferFor('prod-1', 'b')).toEqual({ id: 'n-new', offered_price: 240 });
    });
    it('ignores other buyers, pending / rejected offers and stale deals', async () => {
        expect(await acceptedOfferFor('prod-1', 'b3')).toBeNull();
        expect(await acceptedOfferFor('prod-1', 'nobody')).toBeNull();
        db.price_negotiations = db.price_negotiations.filter(n => n.id !== 'n-new');
        expect(await acceptedOfferFor('prod-1', 'b')).toBeNull(); // only the stale one is left
    });
});
