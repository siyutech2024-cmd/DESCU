/**
 * The order state machine.
 *
 * Every write of `orders.status` goes through `transitionOrder()` in
 * services/orderTransitionService.ts, which enforces the graph below with a
 * conditional UPDATE (… WHERE status IN (<from>)). This file only knows the graph;
 * it has no I/O so routes, services and tests can all share it.
 *
 *   pending_payment ──payment──▶ paid | escrow_held
 *        │  └──expiry / buyer cancel──▶ cancelled
 *        └──(meetup details saved while still unpaid: stays pending_payment)
 *
 *   paid | escrow_held ──▶ meetup_arranged | shipped | completed(_pending_payout) | disputed
 *   paid (cash) ────────▶ cancelled                    (either party, before it is done)
 *   meetup_arranged ────▶ meetup_arranged (re-arranged) | completed(_pending_payout) | disputed | cancelled (cash)
 *   shipped ────────────▶ completed(_pending_payout) | disputed
 *   delivered (legacy) ─▶ completed(_pending_payout) | disputed      nothing writes it any more
 *   disputed ───────────▶ refunded | completed(_pending_payout)      admin ruling
 *   completed_pending_payout ─▶ completed                            manual SPEI recorded
 *   completed / cancelled / refunded                                 terminal
 */

export const ORDER_STATUSES = [
    'pending_payment',
    'paid',
    'escrow_held',
    'meetup_arranged',
    'shipped',
    'delivered',
    'completed_pending_payout',
    'completed',
    'cancelled',
    'disputed',
    'refunded',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const isOrderStatus = (v: unknown): v is OrderStatus =>
    typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v);

/** Statuses where the order is waiting for the buyer's money. */
export const AWAITING_PAYMENT_STATUSES: readonly OrderStatus[] = ['pending_payment', 'meetup_arranged'];

/** Paid (or cash) and not yet closed: goods/money are in flight. */
export const IN_FLIGHT_STATUSES: readonly OrderStatus[] = ['paid', 'escrow_held', 'meetup_arranged', 'shipped', 'delivered'];

/** Nothing can happen to these orders any more. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled', 'refunded'];

/** The two ways an order finishes successfully. */
export const COMPLETION_STATUSES: readonly OrderStatus[] = ['completed', 'completed_pending_payout'];

const has = (list: readonly OrderStatus[], status: unknown): boolean => (list as readonly string[]).includes(status as string);
export const isAwaitingPayment = (status: unknown): boolean => has(AWAITING_PAYMENT_STATUSES, status);
export const isInFlight = (status: unknown): boolean => has(IN_FLIGHT_STATUSES, status);
export const isTerminal = (status: unknown): boolean => has(TERMINAL_STATUSES, status);
export const isCompletion = (status: unknown): boolean => has(COMPLETION_STATUSES, status);

const COMPLETE_OR_DISPUTE: readonly OrderStatus[] = [...COMPLETION_STATUSES, 'disputed'];

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
    pending_payment: ['paid', 'escrow_held', 'cancelled'],
    paid: ['meetup_arranged', 'shipped', ...COMPLETE_OR_DISPUTE, 'cancelled'],
    escrow_held: ['meetup_arranged', 'shipped', ...COMPLETE_OR_DISPUTE],
    // `paid`/`escrow_held` here cover legacy meetup orders arranged before they were paid.
    meetup_arranged: ['meetup_arranged', 'paid', 'escrow_held', ...COMPLETE_OR_DISPUTE, 'cancelled'],
    shipped: COMPLETE_OR_DISPUTE,
    delivered: COMPLETE_OR_DISPUTE,
    disputed: ['refunded', ...COMPLETION_STATUSES],
    completed_pending_payout: ['completed'],
    completed: [],
    cancelled: [],
    refunded: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
    ORDER_TRANSITIONS[from]?.includes(to) ?? false;

/** Status a freshly created order starts in. Cash is settled in person, so it is "paid" at once. */
export const initialOrderStatus = (paymentMethod: 'online' | 'cash'): OrderStatus =>
    paymentMethod === 'cash' ? 'paid' : 'pending_payment';

/** How long an unpaid online order is held before it can be expired. */
export const ORDER_PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * Extra time after `expires_at` before the expiry job cancels the order. OXXO/SPEI
 * vouchers issued inside the window can take up to 3 days to settle, and the cancel
 * only ever applies to rows whose payment has not been captured.
 */
export const ORDER_EXPIRY_GRACE_MS = 48 * 60 * 60 * 1000;

/**
 * Whether `actor` may cancel `order` right now; returns the reason when not.
 * Unpaid online orders: buyer only. Cash orders that are not yet finished: either party.
 * Once money has been captured, only a dispute (and the admin) can unwind the order.
 */
export const cancelBlockReason = (
    order: { status: string; payment_method?: string | null; payment_captured?: boolean | null; buyer_id: string; seller_id: string },
    actorId: string,
): string | null => {
    const isBuyer = order.buyer_id === actorId;
    const isSeller = order.seller_id === actorId;
    if (!isBuyer && !isSeller) return 'Not authorized for this order';
    if (isTerminal(order.status)) return `Order cannot be cancelled in status "${order.status}"`;
    if (order.payment_method === 'online') {
        if (order.payment_captured === true || order.status !== 'pending_payment') {
            return 'A paid order cannot be cancelled; open a dispute instead';
        }
        if (!isBuyer) return 'Only the buyer can cancel an unpaid order';
    }
    if (!isOrderStatus(order.status) || !canTransition(order.status, 'cancelled')) {
        return `Order cannot be cancelled in status "${order.status}"`;
    }
    return null;
};
