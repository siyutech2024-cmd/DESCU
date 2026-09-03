-- =============================================================================
-- DESCU security hardening — 2026-09-03
-- Run in Supabase → SQL Editor (as postgres). Idempotent; safe to re-run.
--
-- Pairs with the application release that:
--   * reads the admin role from auth app_metadata (not user_metadata)
--   * requires authentication + participant checks on all chat endpoints
--   * moves seller bank details behind /api/users/bank-info
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Admin role → app_metadata
--    user_metadata is writable by the user themself (privilege escalation);
--    app_metadata can only be written server-side. Copy existing admins over,
--    then strip the client-writable copy so it can never be mistaken for authority.
-- -----------------------------------------------------------------------------
-- !! Do NOT blindly copy user_metadata.role: anyone could have written it. Grant only
-- !! the accounts you know. Review the current claimants first:
--   SELECT id, email, raw_user_meta_data->>'role' AS claimed_role, created_at
--   FROM auth.users WHERE raw_user_meta_data->>'role' IN ('admin','super_admin');
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || '{"role": "super_admin", "permissions": ["all"]}'::jsonb
WHERE email IN (
  'admin@descu.ai'            -- <-- confirmed DESCU admin account(s); add others explicitly
);

-- Optional clean-up AFTER the new API is live (the old API read user_metadata, so keep
-- it until then). The new API ignores user_metadata entirely either way.
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data - 'role' - 'permissions'
-- WHERE raw_user_meta_data ? 'role';

-- -----------------------------------------------------------------------------
-- 2. anon may never write. SELECT stays governed by RLS per table.
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

-- -----------------------------------------------------------------------------
-- 3. sellers: bank details are private to the owner (API uses service role).
-- -----------------------------------------------------------------------------
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to sellers" ON public.sellers;
DROP POLICY IF EXISTS "Users can CRUD their own seller profile" ON public.sellers;
DROP POLICY IF EXISTS "Users can insert own seller profile" ON public.sellers;
DROP POLICY IF EXISTS "Users can update own seller profile" ON public.sellers;
DROP POLICY IF EXISTS "Users can view own seller profile" ON public.sellers;
DROP POLICY IF EXISTS "sellers_owner_all" ON public.sellers;
CREATE POLICY "sellers_owner_all" ON public.sellers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP INDEX IF EXISTS public.idx_sellers_bank_clabe;  -- no query needs an index on account numbers

-- -----------------------------------------------------------------------------
-- 4. conversations / messages
--    Live DB (checked 2026-09-03) already has RLS on with participant policies
--    ("Users can view their own conversations", "messages_select_policy",
--    "messages_insert_policy" — note user1_id/user2_id/sender_id are TEXT there).
--    We only make sure RLS stays on and add the indexes those policies need.
--    Conversation creation stays API-only (no client INSERT policy on purpose).
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON public.conversations (user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON public.conversations (user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_product ON public.conversations (product_id);

-- -----------------------------------------------------------------------------
-- 5. admin_logs: service role only (the API writes/reads it). The live DB has
--    four permissive policies (two USING(true), two for any authenticated user).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.admin_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "管理员可以查看操作日志" ON public.admin_logs';
    EXECUTE 'DROP POLICY IF EXISTS "管理员可以插入操作日志" ON public.admin_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated insert logs" ON public.admin_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated select logs" ON public.admin_logs';
    -- no policies => only service_role (bypasses RLS) can access
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. products: a seller may edit only their own listing and may never
--    self-promote, self-verify or skip review. RLS can't compare OLD/NEW, so a
--    trigger pins the protected columns for requests made as the authenticated/anon
--    database roles (the API's service-role writes are unaffected).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Sellers can update own products" ON public.products;
DROP POLICY IF EXISTS "products_owner_update"           ON public.products;
CREATE POLICY "products_owner_update" ON public.products
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can create products" ON public.products;
DROP POLICY IF EXISTS "products_owner_insert"     ON public.products;
CREATE POLICY "products_owner_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id AND status = 'pending_review' AND is_promoted = false AND seller_verified = false);

CREATE OR REPLACE FUNCTION public.products_guard_seller_updates()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- PostgREST runs end-user requests as the `authenticated` / `anon` database roles.
  -- Constrain those (fail closed); service_role (the API) and postgres may change anything.
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.is_promoted     := OLD.is_promoted;
    NEW.seller_verified := OLD.seller_verified;
    NEW.seller_id       := OLD.seller_id;
    NEW.views_count     := OLD.views_count;
    NEW.reported_count  := OLD.reported_count;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('sold', 'pending_review', 'inactive') THEN
      RAISE EXCEPTION 'sellers may only set status to sold, pending_review or inactive';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_guard_seller_updates ON public.products;
CREATE TRIGGER trg_products_guard_seller_updates
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_guard_seller_updates();

COMMIT;

-- ---- Verify ----------------------------------------------------------------
-- SELECT email, raw_app_meta_data->>'role' FROM auth.users WHERE raw_app_meta_data->>'role' IS NOT NULL;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('sellers','conversations','messages','admin_logs','products');
-- SELECT polname, polrelid::regclass FROM pg_policy WHERE polrelid IN ('public.sellers'::regclass,'public.conversations'::regclass,'public.messages'::regclass);
