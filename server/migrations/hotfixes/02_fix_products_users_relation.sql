-- ==============================================================================
-- DESCU MARKETPLACE - FIX RELATIONSHIPS SCRIPT (V2 - Corrected)
-- ==============================================================================
-- 1. Create public.users table FIRST
-- This table is required for the API to expand 'seller' info.
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Backfill public.users from auth.users
-- This ensures existing users (sellers) exist in the public table before we link them.
-- Note: This requires privileges usually available in the SQL Editor.
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. RLS for Users Table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are visible to everyone" ON public.users;
CREATE POLICY "Public profiles are visible to everyone" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Automatically Sync New Users (Trigger)
-- Ensures future sign-ups are added to public.users automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. Fix Products Table Relationship
DO $$ 
BEGIN 
    -- Ensure seller_id is UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'seller_id' AND data_type = 'text'
    ) THEN
        ALTER TABLE products ALTER COLUMN seller_id TYPE UUID USING seller_id::uuid;
    END IF;
END $$;

-- 6. Add Foreign Key Constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_seller;
ALTER TABLE products
ADD CONSTRAINT fk_products_seller
FOREIGN KEY (seller_id) 
REFERENCES public.users(id)
ON DELETE CASCADE;

-- 7. Grant Permissions (Optional but good for API access)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
