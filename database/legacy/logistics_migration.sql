-- Logistics & Address Management Migration

-- 1. Create user_addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    country TEXT DEFAULT 'MX',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

-- 2. RLS Policies
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own addresses
CREATE POLICY "Users can view their own addresses"
    ON user_addresses FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own addresses
CREATE POLICY "Users can insert their own addresses"
    ON user_addresses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own addresses
CREATE POLICY "Users can update their own addresses"
    ON user_addresses FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own addresses
CREATE POLICY "Users can delete their own addresses"
    ON user_addresses FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Trigger to handle is_default logic (Ensure only one default per user)
CREATE OR REPLACE FUNCTION handle_default_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE user_addresses
        SET is_default = FALSE
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_default_address ON user_addresses;
CREATE TRIGGER trigger_handle_default_address
    BEFORE INSERT OR UPDATE ON user_addresses
    FOR EACH ROW
    EXECUTE FUNCTION handle_default_address();

-- 4. Add shipping fields to orders table if not present (already checked schema, shipping_address is likely JSONB or similar, let's verify)
-- In types.ts: shipping_address?: any;
-- In create_user_tables.sql (not seen full schema, but likely JSONB). 
-- Let's add columns just in case to be explicit, or rely on existing JSONB if flexible.
-- To be safe, let's add specific columns for tracking.

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB, -- Stores the full address at time of purchase
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

