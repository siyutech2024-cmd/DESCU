/**
 * Order domain rules shared by routes, controllers and tests.
 * Keep money/state decisions here so every endpoint agrees.
 */

export const ORDER_TYPES = ['meetup', 'shipping'] as const;
export const PAYMENT_METHODS = ['online', 'cash'] as const;
export type OrderType = typeof ORDER_TYPES[number];
export type PaymentMethod = typeof PAYMENT_METHODS[number];

/** Platform commission on online payments (buyer pays it on top of the price). */
export const PLATFORM_FEE_RATE = 0.05;
/** Flat shipping fee in MXN. */
export const SHIPPING_FEE_MXN = 50;

/** Statuses from which a buyer/seller "confirm" is meaningful. */
export const CONFIRMABLE_STATUSES = ['paid', 'escrow_held', 'meetup_arranged', 'shipped', 'delivered'] as const;

export interface OrderLike {
    status: string;
    payment_method?: string | null;
    payment_captured?: boolean | null;
    escrow_status?: string | null;
}

export const isOrderType = (v: unknown): v is OrderType => ORDER_TYPES.includes(v as OrderType);
export const isPaymentMethod = (v: unknown): v is PaymentMethod => PAYMENT_METHODS.includes(v as PaymentMethod);

/** Money has actually been collected for this order (cash is settled in person). */
export const isPaymentSettled = (order: OrderLike): boolean => {
    if (order.payment_method === 'cash') return true;
    return order.payment_captured === true || order.escrow_status === 'held' || order.escrow_status === 'released';
};

/** Whether a confirm action is allowed right now; returns a reason when it is not. */
export const confirmBlockReason = (order: OrderLike): string | null => {
    if (order.status === 'completed') return 'Order already completed';
    if (!(CONFIRMABLE_STATUSES as readonly string[]).includes(order.status)) {
        return `Order cannot be confirmed in status "${order.status}"`;
    }
    if (!isPaymentSettled(order)) return 'Payment has not been received for this order';
    return null;
};

export interface OrderAmounts {
    productAmount: number;
    shippingFee: number;
    platformFee: number;
    totalAmount: number;
}

/** Amounts in major units (MXN) as stored on the order row. */
export const computeOrderAmounts = (price: number, orderType: OrderType, paymentMethod: PaymentMethod): OrderAmounts => {
    const productAmount = round2(price);
    const shippingFee = orderType === 'shipping' ? SHIPPING_FEE_MXN : 0;
    const platformFee = paymentMethod === 'online' ? round2(productAmount * PLATFORM_FEE_RATE) : 0;
    return { productAmount, shippingFee, platformFee, totalAmount: round2(productAmount + shippingFee + platformFee) };
};

export interface ReleaseAmounts {
    totalCents: number;
    platformFeeCents: number;
    transferCents: number;
}

/**
 * What the seller receives when escrow is released, in cents.
 * Legacy rows may lack `platform_fee` (or use `amount` instead of `total_amount`);
 * then the standard commission is applied so an admin release and a buyer confirm
 * always pay out the same number.
 */
export const computeReleaseAmounts = (order: {
    total_amount?: number | string | null;
    amount?: number | string | null;
    platform_fee?: number | string | null;
}): ReleaseAmounts => {
    const total = Number(order.total_amount ?? order.amount ?? 0);
    const totalCents = toCents(Number.isFinite(total) ? total : 0);
    const storedFee = order.platform_fee === null || order.platform_fee === undefined ? NaN : Number(order.platform_fee);
    const platformFeeCents = Number.isFinite(storedFee) && storedFee > 0
        ? toCents(storedFee)
        : Math.round(totalCents * PLATFORM_FEE_RATE);
    return { totalCents, platformFeeCents, transferCents: totalCents - platformFeeCents };
};

export const toCents = (amount: number): number => Math.round(amount * 100);
const round2 = (n: number) => Math.round(n * 100) / 100;
