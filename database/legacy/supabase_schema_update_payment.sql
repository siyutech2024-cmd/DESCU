-- Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  buyer_id UUID REFERENCES auth.users(id) NOT NULL,
  seller_id UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MXN',
  status VARCHAR(20) DEFAULT 'pending_payment', -- pending_payment, paid, shipped, completed, cancelled, refunded
  payment_intent_id VARCHAR(100),
  shipping_address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for Orders
-- Buyers can view their own orders
CREATE POLICY "Buyers can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id);

-- Sellers can view orders for their products
CREATE POLICY "Sellers can view orders for their products" ON public.orders
  FOR SELECT USING (auth.uid() = seller_id);

-- Start functionality: Insert (usually handled by backend service role, but allowing authenticated users to init orders if needed, though robust flow uses backend)
-- For this architecture, backend handles creation, so RLS mainly for frontend viewing.

-- Update Products Table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available'; -- available, sold, hidden

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
