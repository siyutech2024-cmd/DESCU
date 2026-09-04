import type { Order } from '@/types';

/**
 * Does `userId` have to do something on this order right now?
 * - buyer: confirm receipt of a shipped item
 * - either party: confirm a meetup that was arranged but not yet confirmed by them
 * - seller: ship a paid shipping order
 */
export const requiresAction = (order: Order, userId: string): boolean => {
    const isBuyer = order.buyer_id === userId;
    const isSeller = order.seller_id === userId;
    if (!isBuyer && !isSeller) return false;

    if (isBuyer && order.status === 'shipped') return true;

    if (order.order_type === 'meetup' && order.status === 'meetup_arranged') {
        const myConfirmation = isBuyer ? order.buyer_confirmed_at : order.seller_confirmed_at;
        return !myConfirmation;
    }

    if (isSeller && order.order_type === 'shipping' && (order.status === 'paid' || order.status === 'escrow_held')) return true;

    return false;
};
