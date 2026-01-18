-- ==============================================================================
-- DESCU MARKETPLACE - HOTFIX: PRODUCTS RLS POLICIES
-- ==============================================================================
-- Fixes "Product information unavailable" for newly purchased (sold) items.
-- Issue: When a product is sold, its status changes. If RLS only allows 'active' products,
-- the buyer cannot see the product details in their order history.
-- 
-- This script:
-- 1. Enables RLS on `products` table (security best practice).
-- 2. Adds/Updates policies to ensure:
--    - Anyone can VIEW products (regardless of status).
--    - Only authenticated users can CREATE products.
--    - Only the seller can UPDATE/DELETE their own products.

DO $$
BEGIN
    -- 1. Enable RLS
    ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;

    -- 2. Grant Access to authenticated and anon roles (in case not granted)
    GRANT ALL ON products TO postgres;
    GRANT ALL ON products TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
    GRANT SELECT ON products TO anon;

    -- 3. Policy: READ (Allow All)
    -- We allow viewing ALL products so buyers can see history of sold items.
    DROP POLICY IF EXISTS "Public can view all products" ON products;
    DROP POLICY IF EXISTS "Anyone can view products" ON products; -- remove potential duplicates
    CREATE POLICY "Public can view all products" ON products 
    FOR SELECT USING (true);

    -- 4. Policy: INSERT (Authenticated Only)
    DROP POLICY IF EXISTS "Users can create products" ON products;
    CREATE POLICY "Users can create products" ON products 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    -- 5. Policy: UPDATE (Seller Only)
    DROP POLICY IF EXISTS "Sellers can update own products" ON products;
    CREATE POLICY "Sellers can update own products" ON products 
    FOR UPDATE USING (auth.uid() = seller_id);

    -- 6. Policy: DELETE (Seller Only)
    DROP POLICY IF EXISTS "Sellers can delete own products" ON products;
    CREATE POLICY "Sellers can delete own products" ON products 
    FOR DELETE USING (auth.uid() = seller_id);

END $$;
