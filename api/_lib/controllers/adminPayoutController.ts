import { HttpError, asyncHandler, parseBody, parseParams, parseQuery } from '../lib/http.js';
import type { AdminRequest } from '../middleware/adminAuth.js';
import { CompletePayoutSchema, ListPayoutsQuerySchema, OrderIdParamSchema } from '../schemas/admin.js';
import { completeManualPayout, listPayouts, markOrderPayoutProcessing } from '../services/payoutService.js';
import { logAdminAction } from './adminController.js';

/**
 * Manual bank-transfer payout queue (admin). All queue/state logic lives in
 * services/payoutService.ts — the same path POST /api/admin/orders/:id/mark-paid uses.
 */

/** GET /api/admin/payouts?status=pending|processing|completed|all */
export const getPayoutQueue = asyncHandler<AdminRequest>(async (req, res) => {
    const { status } = parseQuery(ListPayoutsQuerySchema, req.query);
    const { payouts, stats } = await listPayouts(status);
    res.json({ payouts, stats });
});

/** Record that the seller has been paid (bank reference + optional notes); audited. */
export const completePayout = asyncHandler<AdminRequest>(async (req, res) => {
    const { orderId } = parseParams(OrderIdParamSchema, req.params);
    const { reference, notes } = parseBody(CompletePayoutSchema, req.body);

    const outcome = await completeManualPayout({ orderId, adminId: req.admin?.id ?? null, reference, notes });
    if (!outcome.ok) throw new HttpError(outcome.code, outcome.error);

    if (req.admin) {
        await logAdminAction(
            req.admin.id, req.admin.email, 'manual_payout', 'order', orderId,
            { reference: outcome.order.payout_reference, notes, previous_status: 'completed_pending_payout' },
            req.ip, req.get('user-agent'),
        );
    }

    res.json({ success: true, order: outcome.order });
});

/** Move a pending payout into the "processing" bucket. */
export const markPayoutProcessing = asyncHandler<AdminRequest>(async (req, res) => {
    const { orderId } = parseParams(OrderIdParamSchema, req.params);

    const outcome = await markOrderPayoutProcessing(orderId);
    if (!outcome.ok) throw new HttpError(outcome.code, outcome.error);

    res.json({ success: true, order: outcome.order });
});
