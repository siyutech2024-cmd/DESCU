import { supabase } from '../db/supabase.js';
import { getStripe } from '../lib/stripe.js';
import { canTransition, computeReleaseAmounts, isOrderStatus, isPaymentSettled, type OrderLike, type OrderStatus } from '../domain/orders.js';
import { transitionOrder } from './orderTransitionService.js';

/**
 * The single place where an order is completed and (for online payments) the escrowed
 * money is released to the seller. Used by:
 *   - POST /api/orders/confirm          (buyer confirms receipt)
 *   - POST /api/orders/:id/confirm      (both parties confirmed a meetup)
 *   - POST /api/admin/disputes/resolve  (admin rules in favour of the seller)
 *
 * Guarantees:
 *   - `orders.confirmed_at` is a lock: only one caller finalises an order at a time.
 *     A stale lock (crash mid-way) can be re-entered after LOCK_TTL_MS; the Stripe
 *     idempotency key `escrow_release_<orderId>` makes the retry safe.
 *   - Cash orders never enter the payout queue.
 *   - Online orders whose seller has no Connect account, or whose transfer fails, become
 *     `completed_pending_payout` (manual SPEI by the admin) with a timeline entry.
 */

const LOCK_TTL_MS = 10 * 60 * 1000;

export type ReleaseOutcome =
    | { ok: true; status: 'completed' | 'completed_pending_payout'; transferId: string | null; transferAmount: number; platformFee: number }
    | { ok: false; code: 409 | 500; error: string };

export interface ReleaseContext {
    /** Who triggered the release (user id or admin id); written to the timeline. */
    actorId: string | null;
    /** 'buyer_confirm' | 'dual_confirm' | 'dispute' */
    source: string;
    description?: string;
}

export interface ReleasableOrder extends OrderLike {
    id: string;
    seller_id: string;
    product_id?: string | null;
    currency?: string | null;
    total_amount?: number | string | null;
    amount?: number | string | null;
    platform_fee?: number | string | null;
    transferred_to_seller?: boolean | null;
    stripe_transfer_id?: string | null;
    [key: string]: unknown;
}

export const releaseEscrow = async (order: ReleasableOrder, ctx: ReleaseContext): Promise<ReleaseOutcome> => {
    const orderId: string = order.id;

    // 0. The state graph must allow completion from where the order is *before* any money moves.
    if (!isOrderStatus(order.status) || !canTransition(order.status, 'completed')) {
        return { ok: false, code: 409, error: `Order cannot be completed from status "${order.status}"` };
    }

    // 1. Lock (re-enterable when stale).
    const lockedAt = new Date().toISOString();
    const staleBefore = new Date(Date.now() - LOCK_TTL_MS).toISOString();
    const { data: locked, error: lockError } = await supabase
        .from('orders')
        .update({ confirmed_at: lockedAt })
        .eq('id', orderId)
        .eq('status', order.status)
        .or(`confirmed_at.is.null,confirmed_at.lt.${staleBefore}`)
        .select('id');
    if (lockError) return { ok: false, code: 500, error: lockError.message };
    if (!locked || locked.length === 0) return { ok: false, code: 409, error: 'This order is already being confirmed' };

    const releaseLock = async () => {
        await supabase.from('orders').update({ confirmed_at: null }).eq('id', orderId).eq('confirmed_at', lockedAt);
    };

    const isOnlinePayment = order.payment_method === 'online' && isPaymentSettled(order);
    let newStatus: 'completed' | 'completed_pending_payout' = 'completed';
    let transferId: string | null = order.stripe_transfer_id ?? null;
    const currency = String(order.currency || 'mxn').toLowerCase();
    const { totalCents, platformFeeCents, transferCents } = computeReleaseAmounts(order);
    let transferAmount = 0;
    let platformFeeCollected = 0;

    if (isOnlinePayment && order.transferred_to_seller) {
        // Money already moved (e.g. a previous attempt finalised the transfer but not the status).
        transferAmount = transferCents;
        platformFeeCollected = platformFeeCents;
    } else if (isOnlinePayment) {
        const { data: seller, error: sellerError } = await supabase
            .from('sellers')
            .select('stripe_connect_id')
            .eq('user_id', order.seller_id)
            .maybeSingle();
        if (sellerError) { await releaseLock(); return { ok: false, code: 500, error: sellerError.message }; }

        if (seller?.stripe_connect_id) {
            if (!Number.isFinite(transferCents) || transferCents <= 0) {
                await releaseLock();
                return { ok: false, code: 500, error: 'Invalid transfer amount' };
            }
            try {
                // Metadata must be identical across callers: Stripe rejects a reused
                // idempotency key whose parameters differ.
                const transfer = await getStripe().transfers.create({
                    amount: transferCents,
                    currency,
                    destination: seller.stripe_connect_id,
                    metadata: {
                        order_id: orderId,
                        seller_id: order.seller_id,
                        platform_fee: platformFeeCents,
                        original_amount: totalCents,
                    },
                    description: `DESCU Order ${orderId} - Escrow Release`,
                }, { idempotencyKey: `escrow_release_${orderId}` });
                transferId = transfer.id;
                transferAmount = transferCents;
                platformFeeCollected = platformFeeCents;
            } catch (transferError: any) {
                console.error('[Escrow Release] Transfer failed:', transferError);
                newStatus = 'completed_pending_payout';
                await supabase.from('order_timeline').insert({
                    order_id: orderId,
                    event_type: 'transfer_failed',
                    description: `自动转账失败: ${transferError?.message ?? 'unknown error'}`,
                    metadata: { error: transferError?.message, seller_stripe_id: seller.stripe_connect_id, source: ctx.source },
                });
            }
        } else {
            newStatus = 'completed_pending_payout';
        }
    }

    // 2. Finalise — conditional on still holding the lock so a stale retry cannot
    //    overwrite a live one (or a dispute opened in between).
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { completed_at: now };
    if (isOnlinePayment) {
        updateData.escrow_status = transferId ? 'released' : 'pending_release';
    }
    if (transferId && !order.transferred_to_seller) {
        updateData.stripe_transfer_id = transferId;
        updateData.transferred_to_seller = true;
        updateData.transfer_amount = transferAmount / 100;
        updateData.platform_fee_collected = platformFeeCollected / 100;
    }

    let finalizeError: string | null = null;
    try {
        const finalized = await transitionOrder({
            orderId,
            from: order.status as OrderStatus,
            to: newStatus,
            patch: updateData,
            where: q => q.eq('confirmed_at', lockedAt),
            select: 'id',
        });
        if (!finalized.ok) finalizeError = finalized.code === 400 ? finalized.error : 'lock lost';
    } catch (err: any) {
        finalizeError = err?.message ?? String(err);
    }
    if (finalizeError) {
        // Money may already have moved: keep the lock, surface loudly.
        console.error('[Escrow Release] CRITICAL: order update failed after release', { orderId, transferId, finalizeError });
        await supabase.from('order_timeline').insert({
            order_id: orderId,
            event_type: 'finalize_failed',
            description: 'Order status update failed after escrow release — needs manual reconciliation',
            metadata: { transfer_id: transferId, error: finalizeError, source: ctx.source },
        });
        return { ok: false, code: 500, error: 'Order was released but could not be finalised; support has been notified' };
    }

    // 3. Side effects (best effort).
    if (order.product_id) {
        await supabase.from('products').update({ status: 'sold' }).eq('id', order.product_id);
    }
    await supabase.from('order_timeline').insert({
        order_id: orderId,
        event_type: transferId && transferAmount > 0 ? 'escrow_released' : 'order_confirmed',
        description: ctx.description
            ?? (transferId && transferAmount > 0
                ? `资金 $${(transferAmount / 100).toFixed(2)} MXN 已转入卖家账户`
                : newStatus === 'completed_pending_payout' ? '订单完成，等待手动打款' : '订单完成'),
        created_by: ctx.actorId,
        metadata: {
            transfer_id: transferId,
            transfer_amount: transferAmount / 100,
            platform_fee: platformFeeCollected / 100,
            new_status: newStatus,
            source: ctx.source,
        },
    });

    import('./orderNotificationService.js')
        .then(({ notifyOrderStatus }) => notifyOrderStatus(orderId, 'completed').catch(console.error))
        .catch(console.error);

    return { ok: true, status: newStatus, transferId, transferAmount: transferAmount / 100, platformFee: platformFeeCollected / 100 };
};
