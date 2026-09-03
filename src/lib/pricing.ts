/**
 * Client-side mirror of the order pricing rules in api/_lib/domain/orders.ts.
 * Used only for the preview shown before an order exists; the authoritative
 * amounts are always the ones returned by POST /api/orders/create.
 */
export const PLATFORM_FEE_RATE = 0.05;
export const SHIPPING_FEE_MXN = 50;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const previewOrderAmounts = (price: number, orderType: 'meetup' | 'shipping', paymentMethod: 'online' | 'cash') => {
    const shippingFee = orderType === 'shipping' ? SHIPPING_FEE_MXN : 0;
    const platformFee = paymentMethod === 'online' ? round2(price * PLATFORM_FEE_RATE) : 0;
    return { shippingFee, platformFee, total: round2(price + shippingFee + platformFee) };
};
