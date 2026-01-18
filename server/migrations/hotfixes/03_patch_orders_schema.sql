-- ==============================================================================
-- DESCU MARKETPLACE - HOTFIX: PATCH ORDERS SCHEMA
-- ==============================================================================
-- Fixes "Could not find the 'expires_at' column..." error.
-- Adds all potentially missing columns to the orders table.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS shipping_evidence_urls TEXT[],
ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS seller_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS payment_captured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS transferred_to_seller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS meetup_location TEXT,
ADD COLUMN IF NOT EXISTS meetup_location_lat DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS meetup_location_lng DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS meetup_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS meetup_confirmed_by_buyer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS meetup_confirmed_by_seller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS product_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'MXN';

-- Verify indexes (optional but good for performance)
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at);
