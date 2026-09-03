-- ==============================================================================
-- DESCU MARKETPLACE - COMPLETE MIGRATION SCRIPT
-- ==============================================================================
-- Run this in Supabase SQL Editor to fix "Table Not Found" errors.
-- This script is idempotent (safe to run multiple times).

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id), -- Fixed type to UUID to match auth.users
    seller_name TEXT NOT NULL,
    seller_email TEXT,
    seller_avatar TEXT,
    seller_verified BOOLEAN DEFAULT FALSE,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'MXN',
    images JSONB DEFAULT '[]'::jsonb,
    category TEXT NOT NULL,
    delivery_type TEXT DEFAULT 'both',
    latitude NUMERIC DEFAULT 0,
    longitude NUMERIC DEFAULT 0,
    location_name TEXT,
    status TEXT DEFAULT 'active',
    views_count INTEGER DEFAULT 0,
    reported_count INTEGER DEFAULT 0,
    is_promoted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- 3. ORDERS TABLE (Includes Logistics Columns)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  order_type VARCHAR(20) CHECK (order_type IN ('meetup', 'shipping')),
  payment_method VARCHAR(20) CHECK (payment_method IN ('online', 'cash')),
  status VARCHAR(30) CHECK (status IN ('pending_payment', 'paid', 'meetup_arranged', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed', 'refunded')) DEFAULT 'pending_payment',
  product_amount DECIMAL(10, 2) NOT NULL,
  shipping_fee DECIMAL(10, 2) DEFAULT 0,
  platform_fee DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MXN',
  meetup_location TEXT,
  meetup_location_lat DECIMAL(10, 7),
  meetup_location_lng DECIMAL(10, 7),
  meetup_time TIMESTAMPTZ,
  meetup_confirmed_by_buyer BOOLEAN DEFAULT FALSE,
  meetup_confirmed_by_seller BOOLEAN DEFAULT FALSE,
  shipping_address JSONB,
  shipping_carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  tracking_url TEXT,
  shipping_evidence_urls TEXT[],
  shipping_address_snapshot JSONB,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ, 
  buyer_confirmed_at TIMESTAMPTZ,
  seller_confirmed_at TIMESTAMPTZ,
  auto_confirmed BOOLEAN DEFAULT FALSE,
  stripe_payment_intent_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  payment_captured BOOLEAN DEFAULT FALSE,
  transferred_to_seller BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);

-- 4. USER ADDRESSES TABLE
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
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own addresses" ON user_addresses;
CREATE POLICY "Users can view their own addresses" ON user_addresses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own addresses" ON user_addresses;
CREATE POLICY "Users can insert their own addresses" ON user_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own addresses" ON user_addresses;
CREATE POLICY "Users can update their own addresses" ON user_addresses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own addresses" ON user_addresses;
CREATE POLICY "Users can delete their own addresses" ON user_addresses FOR DELETE USING (auth.uid() = user_id);

-- 5. RATINGS TABLE
CREATE TABLE IF NOT EXISTS ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    rater_id UUID REFERENCES auth.users(id) NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) NOT NULL,
    score INTEGER CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rater_id, target_user_id)
);
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ratings" ON ratings;
CREATE POLICY "Anyone can read ratings" ON ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can rate others" ON ratings;
CREATE POLICY "Users can rate others" ON ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- 6. ORDER TIMELINE
CREATE TABLE IF NOT EXISTS order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view timeline for their orders" ON order_timeline;
CREATE POLICY "Users can view timeline for their orders" ON order_timeline FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_timeline.order_id AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid()))
);

-- 7. CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID, -- Changed to UUID references products(id) if strict, but kept looser for compatibility if previously TEXT
    user1_id UUID NOT NULL,
    user2_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TRIGGERS
CREATE OR REPLACE FUNCTION handle_default_address() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE user_addresses SET is_default = FALSE WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_default_address ON user_addresses;
CREATE TRIGGER trigger_handle_default_address BEFORE INSERT OR UPDATE ON user_addresses FOR EACH ROW EXECUTE FUNCTION handle_default_address();
