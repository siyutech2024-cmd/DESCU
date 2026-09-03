-- Fix broken Unsplash Source URLs in products
UPDATE products
SET images = '["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80"]'::jsonb
WHERE images::text LIKE '%source.unsplash.com%';

-- Create or Replace function to count users securely
CREATE OR REPLACE FUNCTION get_total_users()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT count(*)::integer FROM auth.users;
$$;
