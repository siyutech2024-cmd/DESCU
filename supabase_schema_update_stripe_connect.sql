-- Add payout_method_id to sellers table to track attached cards/bank accounts
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS payout_method_id VARCHAR(100);

-- Ensure stripe_connect_id is unique if not already
ALTER TABLE public.sellers 
ADD CONSTRAINT sellers_stripe_connect_id_key UNIQUE (stripe_connect_id);
