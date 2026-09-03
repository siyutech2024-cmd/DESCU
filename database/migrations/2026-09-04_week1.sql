-- =============================================================================
-- DESCU week-1 fixes — 2026-09-04
-- Run in Supabase → SQL Editor (as postgres). Idempotent; safe to re-run.
--
-- Pairs with the application release that:
--   * dedupes Stripe webhook deliveries (stripe_events)
--   * adds real report / block endpoints (reports, blocks)
--   * moves orders to escrow_held / completed_pending_payout (constraint fix)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. orders: the live table carries TWO status CHECK constraints. `check_status`
--    predates escrow and rejects 'escrow_held' / 'completed_pending_payout', so
--    every escrow payment webhook has been failing the UPDATE. `orders_status_check`
--    already lists the full set and stays as the single source of truth.
-- -----------------------------------------------------------------------------
--    (Verified in the live DB on 2026-09-03: orders_status_check = pending_payment, paid,
--    escrow_held, meetup_arranged, shipped, delivered, completed, completed_pending_payout,
--    cancelled, disputed, refunded.)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_status;

-- -----------------------------------------------------------------------------
-- 2. stripe_events: one row per Stripe event id → webhook retries are no-ops.
--    Service-role only (the API writes it; no client ever reads it).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id     text PRIMARY KEY,
  event_type   text NOT NULL,
  created_at   timestamptz NOT NULL,           -- Stripe's event.created
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON public.stripe_events (processed_at);

-- -----------------------------------------------------------------------------
-- 3. reports: "Report user / listing / message" from the app.
--    Written through the API (service role). Admins read it through the API too.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type  text NOT NULL CHECK (target_type IN ('user', 'product', 'message', 'conversation')),
  target_id    uuid NOT NULL,
  reason       text NOT NULL CHECK (reason IN ('misinfo', 'hate', 'scam', 'prohibited', 'sensitive', 'harassment', 'spam', 'other')),
  description  text,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note   text,
  resolved_by  uuid,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports (reporter_id);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM anon;
-- A user may see (only) the reports they filed; creation goes through the API.
DROP POLICY IF EXISTS reports_reporter_select ON public.reports;
CREATE POLICY reports_reporter_select ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- -----------------------------------------------------------------------------
-- 4. blocks: directional user blocks; the API treats them symmetrically.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks (blocked_id);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocks FROM anon;
DROP POLICY IF EXISTS blocks_owner_all ON public.blocks;
CREATE POLICY blocks_owner_all ON public.blocks
  FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- -----------------------------------------------------------------------------
-- 5. chat: the conversation list computes last message / unread per thread.
--    The API calls conversation_last_messages() (one row per thread) and falls back
--    to a bounded scan when the function does not exist yet.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_unread_by_conversation
  ON public.messages (conversation_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_orders_product_buyer_created
  ON public.orders (product_id, buyer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.conversation_last_messages(p_conversation_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  text            text,
  sender_id       text,
  message_type    text,
  created_at      timestamptz,
  is_read         boolean
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.conversation_id)
         m.conversation_id::uuid, m.text::text, m.sender_id::text, m.message_type::text, m.created_at::timestamptz, COALESCE(m.is_read, false)::boolean
  FROM public.messages m
  WHERE m.conversation_id = ANY (p_conversation_ids)
  ORDER BY m.conversation_id, m.created_at DESC, m.id DESC;
$$;
-- Only the API (service role) may call it; PostgREST clients get no access.
REVOKE ALL ON FUNCTION public.conversation_last_messages(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_last_messages(uuid[]) TO service_role;

COMMIT;

-- ---- Verify ----------------------------------------------------------------
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.orders'::regclass AND contype = 'c';
-- SELECT to_regclass('public.stripe_events'), to_regclass('public.reports'), to_regclass('public.blocks');
