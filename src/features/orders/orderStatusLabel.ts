import type { ChipTone } from '@/components/ui/primitives';

type T = (key: string) => string;

/** Statuses that have their own `orders.status.*` translation. */
const LABELLED = new Set([
    'pending_payment', 'paid', 'escrow_held', 'meetup_arranged', 'shipped', 'delivered',
    'completed', 'cancelled', 'disputed', 'refunded',
]);

/**
 * Human label for an order status in the current language — never the raw enum.
 * `completed_pending_payout` is "completed" for both parties (the payout is an admin detail).
 */
export const orderStatusLabel = (status: string | null | undefined, t: T, opts?: { paymentMethod?: string | null }): string => {
    if (!status) return '';
    if (status === 'completed_pending_payout') return t('orders.status.completed');
    if (status === 'paid' && opts?.paymentMethod === 'cash') return t('orders.status.paid_cash');
    if (LABELLED.has(status)) return t(`orders.status.${status}`);
    return status.replace(/_/g, ' ');
};

export const orderStatusTone = (status: string | null | undefined): ChipTone => {
    switch (status) {
        case 'completed':
        case 'completed_pending_payout':
            return 'success';
        case 'cancelled':
        case 'refunded':
            return 'neutral';
        case 'disputed':
            return 'danger';
        case 'pending_payment':
            return 'warning';
        case undefined:
        case null:
        case '':
            return 'neutral';
        default:
            return 'info';
    }
};
