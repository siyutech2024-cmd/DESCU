-- ==============================================================================
-- DESCU MARKETPLACE - HOTFIX: LEGACY COLUMN CONSTRAINT
-- ==============================================================================
-- Fixes "null value in column 'amount' ... violates not-null constraint" error.
-- The production database has a legacy 'amount' column that is NOT NULL.
-- The new system uses 'total_amount', 'product_amount', etc.
-- This script relaxes the constraint on the old column so the API can proceed.

DO $$
BEGIN
    -- Check if column 'amount' exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'amount') THEN
        -- Make it nullable
        ALTER TABLE public.orders ALTER COLUMN amount DROP NOT NULL;
    END IF;
END $$;
