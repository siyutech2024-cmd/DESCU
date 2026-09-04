import type { Order } from '@/types';
import { requiresAction } from '../orderActions';

const base: Order = {
    id: 'o1',
    product_id: 'p1',
    buyer_id: 'buyer',
    seller_id: 'seller',
    order_type: 'shipping',
    payment_method: 'online',
    status: 'paid',
    product_amount: 100,
    shipping_fee: 0,
    platform_fee: 0,
    total_amount: 100,
    currency: 'MXN',
    created_at: '2026-01-01T00:00:00Z',
};

const order = (patch: Partial<Order>): Order => ({ ...base, ...patch });

describe('requiresAction', () => {
    it('is false for users not on the order', () => {
        expect(requiresAction(order({ status: 'shipped' }), 'someone-else')).toBe(false);
    });

    it('buyer must confirm receipt of a shipped order', () => {
        expect(requiresAction(order({ status: 'shipped' }), 'buyer')).toBe(true);
        expect(requiresAction(order({ status: 'shipped' }), 'seller')).toBe(false);
    });

    it('seller must ship a paid / escrow-held shipping order', () => {
        expect(requiresAction(order({ status: 'paid' }), 'seller')).toBe(true);
        expect(requiresAction(order({ status: 'escrow_held' }), 'seller')).toBe(true);
        expect(requiresAction(order({ status: 'paid' }), 'buyer')).toBe(false);
        // a paid meetup order needs no shipping
        expect(requiresAction(order({ status: 'paid', order_type: 'meetup' }), 'seller')).toBe(false);
    });

    it('meetup_arranged needs the confirmation of whoever has not confirmed yet', () => {
        const arranged = order({ order_type: 'meetup', status: 'meetup_arranged' });
        expect(requiresAction(arranged, 'buyer')).toBe(true);
        expect(requiresAction(arranged, 'seller')).toBe(true);

        const buyerConfirmed = order({ ...arranged, buyer_confirmed_at: '2026-01-02T00:00:00Z' });
        expect(requiresAction(buyerConfirmed, 'buyer')).toBe(false);
        expect(requiresAction(buyerConfirmed, 'seller')).toBe(true);
    });

    it('a delivered shipping order still needs the buyer to confirm receipt', () => {
        expect(requiresAction(order({ status: 'delivered', order_type: 'shipping' }), 'buyer')).toBe(true);
        expect(requiresAction(order({ status: 'delivered', order_type: 'shipping' }), 'seller')).toBe(false);
    });

    it('closed and waiting states are not actionable', () => {
        for (const status of ['pending_payment', 'completed', 'cancelled', 'refunded', 'disputed'] as Order['status'][]) {
            expect(requiresAction(order({ status }), 'buyer')).toBe(false);
            expect(requiresAction(order({ status }), 'seller')).toBe(false);
        }
    });
});
