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
 *   pending    = OPEN AND payout_status IN (NULL, 'pending')
 *   processing = OPEN AND payout_status='processing'
 *   completed  = payout_status='completed'  (terminal; status='completed', transferred_to_seller=true)
 * where OPEN = status='completed_pending_payout'
 *          OR (legacy rows finalised before escrowReleaseService existed:
 *              status IN ('completed','delivered') AND payment_method='online'
 *              AND payment_captured AND transferred_to_seller IS NOT true)
 *
 * Orders whose money already reached the seller through a Stripe transfer have
 * transferred_to_seller=true, so they never appear as "to pay".
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

const LEGACY_OPEN_STATUSES = ['completed', 'delivered'];
const COMPLETED_HISTORY_LIMIT = 200;
const INVALID_UUID = '22P02'; // Postgres invalid_text_representation → treat as "no such order"

/** Filters shared by every "still owes the seller" query: money collected online, not yet transferred, not recorded as paid. */
const openPayoutFilters = <Q extends { or: (f: string) => Q }>(q: Q): Q =>
    q.or('transferred_to_seller.is.null,transferred_to_seller.eq.false')
     .or('payout_status.is.null,payout_status.neq.completed');

const decorate = (order: Record<string, any>) => {
    const sellers = order.seller?.sellers;
    const sellerBank = Array.isArray(sellers) ? sellers[0] ?? null : sellers ?? null;
    return { ...order, payoutAmount: payoutAmountFor(order), sellerBank };
};

export const listPayouts = async (statusParam: unknown = 'pending'): Promise<PayoutListResult> => {
    const status: PayoutQueueStatus = isQueueStatus(statusParam) ? statusParam : 'pending';

    // Open queue (pending + processing) is small and unbounded; completed history is capped
    // and counted separately so it can never push open orders past the PostgREST row limit.
    const [current, legacy, completedRes, completedCount] = await Promise.all([
        supabase.from('orders').select(PAYOUT_SELECT)
            .eq('status', 'completed_pending_payout')
            .order('completed_at', { ascending: true }),
        openPayoutFilters(
            supabase.from('orders').select(PAYOUT_SELECT)
                .in('status', LEGACY_OPEN_STATUSES)
                .eq('payment_method', 'online')
                .eq('payment_captured', true)
        ).order('completed_at', { ascending: true }),
        status === 'pending' || status === 'processing'
            ? Promise.resolve({ data: [], error: null })
            : supabase.from('orders').select(PAYOUT_SELECT)
                .eq('payout_status', 'completed')
                .order('payout_at', { ascending: false })
                .limit(COMPLETED_HISTORY_LIMIT),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payout_status', 'completed'),
    ]);
    for (const r of [current, legacy, completedRes, completedCount]) {
        if (r.error) throw r.error;
    }

    const seen = new Set<string>();
    const open: { bucket: 'pending' | 'processing'; row: Record<string, any> }[] = [];
    for (const order of [...(current.data ?? []), ...(legacy.data ?? [])] as any[]) {
        if (seen.has(order.id)) continue;
        seen.add(order.id);
        if (order.payout_status === 'completed') continue;
        open.push({ bucket: order.payout_status === 'processing' ? 'processing' : 'pending', row: decorate(order) });
    }
    open.sort((a, b) => String(a.row.completed_at ?? '').localeCompare(String(b.row.completed_at ?? '')));
    const completed = ((completedRes.data ?? []) as any[]).map(decorate);

    const pending = open.filter(o => o.bucket === 'pending');
    const stats: PayoutStats = {
        pending: pending.length,
        processing: open.filter(o => o.bucket === 'processing').length,
        completed: completedCount.count ?? completed.length,
        totalPendingAmount: pending.reduce((sum, o) => sum + o.row.payoutAmount, 0),
    };

    const payouts =
        status === 'all' ? [...open.map(o => o.row), ...completed]
        : status === 'completed' ? completed
        : open.filter(o => o.bucket === status).map(o => o.row);

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
        .select('id, status, payment_method, payment_captured, escrow_status, transferred_to_seller, payout_status, completed_at')
        .eq('id', orderId)
        .maybeSingle();
    if (fetchError?.code === INVALID_UUID) return { ok: false, code: 404, error: 'Order not found' };
    if (fetchError) throw fetchError;
    if (!order) return { ok: false, code: 404, error: 'Order not found' };

    if (order.transferred_to_seller || order.payout_status === 'completed') {
        return { ok: false, code: 409, error: 'This order has already been paid out' };
    }
    const isLegacyOpen = LEGACY_OPEN_STATUSES.includes(order.status) && order.payment_method === 'online' && order.payment_captured === true;
    if (order.status !== 'completed_pending_payout' && !isLegacyOpen) {
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

    const { data: paid, error: updateError } = await openPayoutFilters(
        supabase
            .from('orders')
            .update(patch)
            .eq('id', orderId)
            .in('status', ['completed_pending_payout', ...LEGACY_OPEN_STATUSES])
    ).select();
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

    return { ok: true, order: paid[0] };
};

/** Admin has picked the order up and is doing the transfer. */
export const markOrderPayoutProcessing = async (orderId: string): Promise<PayoutMutationResult> => {
    const { data: rows, error } = await openPayoutFilters(
        supabase
            .from('orders')
            .update({ payout_status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .in('status', ['completed_pending_payout', ...LEGACY_OPEN_STATUSES])
    ).select();
    if (error?.code === INVALID_UUID) return { ok: false, code: 404, error: 'Order not found' };
    if (error) throw error;
    if (!rows || rows.length === 0) {
        return { ok: false, code: 409, error: 'Order is not pending manual payout' };
    }
    return { ok: true, order: rows[0] };
};
