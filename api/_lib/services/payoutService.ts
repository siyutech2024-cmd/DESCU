import { supabase } from '../db/supabase.js';
import { computeReleaseAmounts } from '../domain/orders.js';

/**
 * Manual payout queue (SPEI bank transfer by the admin).
 *
 * This is the single source of truth for "which orders still owe the seller money"
 * and for recording that the admin has paid them. It is used by
 *   - GET  /api/admin/payouts                      (queue + stats)
 *   - POST /api/admin/payouts/:orderId/processing  (admin picked the order up)
 *   - POST /api/admin/payouts/:orderId/complete    (transfer done)
 *   - POST /api/admin/orders/:id/mark-paid         (same action from the order list)
 *
 * Queue definition (see escrowReleaseService for how orders get here):
 *   pending    = status='completed_pending_payout' AND payout_status IN (NULL, 'pending')
 *   processing = status='completed_pending_payout' AND payout_status='processing'
 *   completed  = payout_status='completed'  (status='completed', transferred_to_seller=true)
 *
 * Orders whose money already reached the seller through a Stripe transfer never
 * have status='completed_pending_payout', so they never appear as "to pay".
 */

export type PayoutQueueStatus = 'pending' | 'processing' | 'completed' | 'all';

export const PAYOUT_SELECT = `
    id,
    total_amount,
    platform_fee,
    status,
    payment_method,
    transferred_to_seller,
    payout_status,
    payout_at,
    payout_reference,
    created_at,
    completed_at,
    seller_id,
    buyer_id,
    products:product_id(id, title, images),
    seller:seller_id(
        id,
        name,
        email,
        sellers(bank_clabe, bank_name, bank_holder_name)
    )
`;

export interface PayoutStats {
    pending: number;
    processing: number;
    completed: number;
    totalPendingAmount: number;
}

export interface PayoutListResult {
    payouts: Record<string, any>[];
    stats: PayoutStats;
}

const isQueueStatus = (v: unknown): v is PayoutQueueStatus =>
    v === 'pending' || v === 'processing' || v === 'completed' || v === 'all';

/** Which bucket of the queue a row belongs to, or null when it is not in the queue at all. */
export const payoutBucket = (order: Record<string, any>): Exclude<PayoutQueueStatus, 'all'> | null => {
    if (order.payout_status === 'completed') return 'completed';
    if (order.status !== 'completed_pending_payout') return null;
    if (order.payout_status === 'processing') return 'processing';
    if (order.payout_status == null || order.payout_status === 'pending') return 'pending';
    return null;
};

/** What the seller receives, in major units, using the same rule as the Stripe transfer. */
export const payoutAmountFor = (order: { total_amount?: number | string | null; amount?: number | string | null; platform_fee?: number | string | null }): number =>
    computeReleaseAmounts(order).transferCents / 100;

export const listPayouts = async (statusParam: unknown = 'pending'): Promise<PayoutListResult> => {
    const status: PayoutQueueStatus = isQueueStatus(statusParam) ? statusParam : 'pending';

    // One query over the whole queue; stats are computed over all of it, the list is
    // the requested slice. The queue is small (only orders awaiting/finished manual payout).
    const { data: orders, error } = await supabase
        .from('orders')
        .select(PAYOUT_SELECT)
        .or('status.eq.completed_pending_payout,payout_status.eq.completed')
        .order('completed_at', { ascending: true });
    if (error) throw error;

    const queue: { bucket: Exclude<PayoutQueueStatus, 'all'>; row: Record<string, any> }[] = [];
    for (const order of (orders || []) as any[]) {
        const bucket = payoutBucket(order);
        if (!bucket) continue;
        queue.push({
            bucket,
            row: { ...order, payoutAmount: payoutAmountFor(order), sellerBank: order.seller?.sellers?.[0] || null },
        });
    }

    const stats: PayoutStats = {
        pending: queue.filter(o => o.bucket === 'pending').length,
        processing: queue.filter(o => o.bucket === 'processing').length,
        completed: queue.filter(o => o.bucket === 'completed').length,
        totalPendingAmount: queue.filter(o => o.bucket === 'pending').reduce((sum, o) => sum + o.row.payoutAmount, 0),
    };

    const payouts = queue.filter(o => status === 'all' || o.bucket === status).map(o => o.row);

    return { payouts, stats };
};

export type PayoutMutationResult =
    | { ok: true; order: Record<string, any> }
    | { ok: false; code: 404 | 409; error: string };

export interface CompleteManualPayoutInput {
    orderId: string;
    adminId: string | null;
    reference?: string | null;
    notes?: string | null;
}

/**
 * Record that the admin has transferred the seller's money by bank.
 * Conditional on the order still being `completed_pending_payout`, so a double click or two
 * admins cannot record the payout twice; refuses when Stripe already moved the money.
 */
export const completeManualPayout = async ({ orderId, adminId, reference, notes }: CompleteManualPayoutInput): Promise<PayoutMutationResult> => {
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, status, payment_method, escrow_status, transferred_to_seller, completed_at')
        .eq('id', orderId)
        .maybeSingle();
    if (fetchError) throw fetchError;
    if (!order) return { ok: false, code: 404, error: 'Order not found' };

    if (order.transferred_to_seller) {
        return { ok: false, code: 409, error: 'Funds were already transferred to the seller; nothing to pay out manually' };
    }
    if (order.status !== 'completed_pending_payout') {
        return { ok: false, code: 409, error: `Order is not pending manual payout (status: ${order.status})` };
    }

    const now = new Date().toISOString();
    const payoutReference = (typeof reference === 'string' && reference.trim()) ? reference.trim() : `MANUAL-${Date.now()}`;
    const patch: Record<string, unknown> = {
        status: 'completed',
        transferred_to_seller: true,
        payout_status: 'completed',
        payout_at: now,
        payout_reference: payoutReference,
        updated_at: now,
    };
    if (order.payment_method === 'online') patch.escrow_status = 'released';
    if (!order.completed_at) patch.completed_at = now;

    const { data: paid, error: updateError } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', orderId)
        .eq('status', 'completed_pending_payout')
        .or('transferred_to_seller.is.null,transferred_to_seller.eq.false')
        .select();
    if (updateError) throw updateError;
    if (!paid || paid.length === 0) {
        return { ok: false, code: 409, error: 'Order is no longer pending payout' };
    }

    const cleanNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null;
    await supabase.from('order_timeline').insert({
        order_id: orderId,
        event_type: 'manual_payout_completed',
        description: `Manual payout completed via bank transfer: ${payoutReference}${cleanNotes ? ` — ${cleanNotes}` : ''}`,
        created_by: adminId,
        metadata: { reference: payoutReference, notes: cleanNotes },
    });

    console.log('[Payout] Manual payout recorded:', orderId, 'reference:', payoutReference);
    return { ok: true, order: paid[0] };
};

/** Admin has picked the order up and is doing the transfer. */
export const markOrderPayoutProcessing = async (orderId: string): Promise<PayoutMutationResult> => {
    const { data: rows, error } = await supabase
        .from('orders')
        .update({ payout_status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'completed_pending_payout')
        .select();
    if (error) throw error;
    if (!rows || rows.length === 0) {
        return { ok: false, code: 409, error: 'Order is not pending manual payout' };
    }
    return { ok: true, order: rows[0] };
};
