-- 1. Enable UUID Extension (Essential)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create ORDERS Table (If not exists)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  buyer_id UUID REFERENCES auth.users(id) NOT NULL,
  seller_id UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MXN',
  status VARCHAR(20) DEFAULT 'pending_payment', -- pending_payment, paid, shipped, completed, disputed, refunded, cancelled
  payment_intent_id VARCHAR(100),
  shipping_carrier VARCHAR(50),
  tracking_number VARCHAR(100),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Orders Policies
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
CREATE POLICY "Buyers can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);


-- 3. Create SELLERS Table (For Stripe Connect)
CREATE TABLE IF NOT EXISTS public.sellers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  stripe_connect_id VARCHAR(100),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Sellers
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Sellers Policies
DROP POLICY IF EXISTS "Users can view own seller profile" ON public.sellers;
CREATE POLICY "Users can view own seller profile" ON public.sellers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own seller profile" ON public.sellers;
CREATE POLICY "Users can update own seller profile" ON public.sellers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own seller profile" ON public.sellers;
CREATE POLICY "Users can insert own seller profile" ON public.sellers
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 4. Create DISPUTES Table
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL, -- Either buyer or seller can raise? Usually buyer.
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open', -- open, resolved_refund, resolved_release
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Disputes Policies
DROP POLICY IF EXISTS "Users can view disputes they are involved in" ON public.disputes;
CREATE POLICY "Users can view disputes they are involved in" ON public.disputes
  FOR SELECT USING (auth.uid() = (SELECT buyer_id FROM public.orders WHERE id = order_id) OR 
                    auth.uid() = (SELECT seller_id FROM public.orders WHERE id = order_id));

DROP POLICY IF EXISTS "Users can create disputes for their orders" ON public.disputes;
CREATE POLICY "Users can create disputes for their orders" ON public.disputes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 5. Grant Permissions (Crucial for Anon Access via API if policies allow)
GRANT ALL ON public.orders TO postgres;
GRANT ALL ON public.orders TO anon;
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT ALL ON public.sellers TO postgres;
GRANT ALL ON public.sellers TO anon;
GRANT ALL ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;

GRANT ALL ON public.disputes TO postgres;
GRANT ALL ON public.disputes TO anon;
GRANT ALL ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
