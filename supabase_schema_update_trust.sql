-- Update Orders Table with Shipping Info
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(50),
ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS auto_confirm_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Create Disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) NOT NULL,
  seller_id UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open', -- open, resolved_refund, resolved_release, cancelled
  evidence_images JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view disputes they are involved in" ON public.disputes
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can open disputes" ON public.disputes
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes(order_id);
