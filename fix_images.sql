-- Fix broken Unsplash Source URLs in products
UPDATE products
SET images = '["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80"]'::jsonb
WHERE images::text LIKE '%source.unsplash.com%';

-- Optional: You can try to be more specific based on category if you want, but a blanket fix is safer for now.
-- Example for vehicles:
-- UPDATE products SET images = ARRAY['https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80'] WHERE category = 'vehicles' AND images::text LIKE '%source.unsplash.com%';
