-- Add Manual Payout Columns to Sellers Table
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(100);

-- Update Confirm Order Logic (Manual Payout Support)
-- No SQL change needed for logic, handled in API.
-- Adding a status for manual payout tracking might be useful.
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (
  status IN ('pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'refunded', 'cancelled', 'completed_pending_payout')
);
