-- Create Sellers Table
CREATE TABLE IF NOT EXISTS public.sellers (
  user_id UUID REFERENCES auth.users(id) NOT NULL PRIMARY KEY,
  stripe_connect_id VARCHAR(255),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can read/write their own seller profile
CREATE POLICY "Users can CRUD their own seller profile" ON public.sellers
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone (e.g. buyers) can read seller info (if we want to show 'Verified Seller' badge etc, though strict Connect ID might be private? Connect ID is generally public-safe but keeping it backend-only is better. Let's allow read for now as we might need to check if seller exists)
CREATE POLICY "Public read access to sellers" ON public.sellers
  FOR SELECT USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_sellers_stripe_id ON public.sellers(stripe_connect_id);
