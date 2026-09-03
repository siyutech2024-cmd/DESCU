-- ============================================================
-- DESCU Escrow Payment System Schema Update
-- Adds support for escrow-based payments with delayed transfers
-- ============================================================

-- 1. Add escrow-related columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS transfer_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS platform_fee_collected DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payout_id VARCHAR(100);

-- 2. Update platform_fee column if not exists
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2);

-- 3. Update orders status constraint to include escrow_held
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (
  status IN (
    'pending_payment',
    'escrow_held',           -- NEW: Funds held in platform account
    'paid',
    'shipped',
    'meetup_arranged',
    'completed',
    'disputed',
    'refunded',
    'cancelled',
    'completed_pending_payout'
  )
);

-- 4. Add comments for documentation
COMMENT ON COLUMN public.orders.escrow_status IS 
  'Escrow status: none (no escrow), pending (awaiting payment), held (funds in platform), released (transferred to seller), refunded';

COMMENT ON COLUMN public.orders.transfer_amount IS 
  'Amount transferred to seller (after platform fee deduction)';

COMMENT ON COLUMN public.orders.platform_fee_collected IS 
  'Platform fee collected from this order';

COMMENT ON COLUMN public.orders.platform_fee IS 
  'Expected platform fee for this order (calculated at checkout)';

-- 5. Create index for escrow status queries
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status ON public.orders(escrow_status);
CREATE INDEX IF NOT EXISTS idx_orders_status_escrow ON public.orders(status) WHERE status = 'escrow_held';

-- 6. Create payout tracking table for seller withdrawals
CREATE TABLE IF NOT EXISTS public.seller_payouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    stripe_payout_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'MXN',
    status VARCHAR(20) DEFAULT 'pending',  -- pending, in_transit, paid, failed, canceled
    arrival_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for seller_payouts
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- Policies for seller_payouts
DROP POLICY IF EXISTS "Sellers can view own payouts" ON public.seller_payouts;
CREATE POLICY "Sellers can view own payouts" ON public.seller_payouts
    FOR SELECT USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.seller_payouts TO postgres;
GRANT ALL ON public.seller_payouts TO authenticated;
GRANT ALL ON public.seller_payouts TO service_role;

-- 7. Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_seller_payouts_updated_at ON public.seller_payouts;
CREATE TRIGGER update_seller_payouts_updated_at
    BEFORE UPDATE ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VERIFICATION QUERIES
-- Run these to verify the schema update was successful
-- ============================================================

-- Check orders table columns
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'orders' 
-- AND column_name IN ('escrow_status', 'transfer_amount', 'platform_fee_collected', 'platform_fee');

-- Check status constraint
-- SELECT constraint_name, check_clause 
-- FROM information_schema.check_constraints 
-- WHERE constraint_name = 'orders_status_check';

-- Check seller_payouts table exists
-- SELECT * FROM information_schema.tables WHERE table_name = 'seller_payouts';
