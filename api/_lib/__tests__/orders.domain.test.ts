import { computeOrderAmounts, confirmBlockReason, isOrderType, isPaymentMethod, isPaymentSettled, toCents } from '../domain/orders';

describe('order amounts', () => {
    it('adds shipping and a 5% platform fee for online orders', () => {
        expect(computeOrderAmounts(1000, 'shipping', 'online')).toEqual({
            productAmount: 1000, shippingFee: 50, platformFee: 50, totalAmount: 1100,
        });
    });
    it('charges no platform fee for cash meetups', () => {
        expect(computeOrderAmounts(199.99, 'meetup', 'cash')).toEqual({
            productAmount: 199.99, shippingFee: 0, platformFee: 0, totalAmount: 199.99,
        });
    });
    it('rounds to cents without floating point drift', () => {
        const a = computeOrderAmounts(10.1, 'meetup', 'online');
        expect(a.platformFee).toBe(0.51);
        expect(a.totalAmount).toBe(10.61);
        expect(toCents(a.totalAmount)).toBe(1061);
    });
    it('validates enums', () => {
        expect(isOrderType('meetup')).toBe(true);
        expect(isOrderType('pickup')).toBe(false);
        expect(isPaymentMethod('online')).toBe(true);
        expect(isPaymentMethod('crypto')).toBe(false);
    });
});

describe('confirmBlockReason', () => {
    it('blocks unpaid online orders', () => {
        expect(confirmBlockReason({ status: 'pending_payment', payment_method: 'online' })).toMatch(/cannot be confirmed/);
        expect(confirmBlockReason({ status: 'paid', payment_method: 'online', payment_captured: false })).toMatch(/Payment has not been received/);
    });
    it('allows captured online orders and cash orders', () => {
        expect(confirmBlockReason({ status: 'paid', payment_method: 'online', payment_captured: true })).toBeNull();
        expect(confirmBlockReason({ status: 'escrow_held', payment_method: 'online', escrow_status: 'held' })).toBeNull();
        expect(confirmBlockReason({ status: 'paid', payment_method: 'cash' })).toBeNull();
    });
    it('blocks completed, cancelled and disputed orders', () => {
        expect(confirmBlockReason({ status: 'completed', payment_method: 'cash' })).toBe('Order already completed');
        expect(confirmBlockReason({ status: 'cancelled', payment_method: 'cash' })).toMatch(/cancelled/);
        expect(confirmBlockReason({ status: 'disputed', payment_method: 'cash' })).toMatch(/disputed/);
    });
    it('isPaymentSettled treats cash as settled', () => {
        expect(isPaymentSettled({ status: 'paid', payment_method: 'cash' })).toBe(true);
        expect(isPaymentSettled({ status: 'paid', payment_method: 'online' })).toBe(false);
    });
});
