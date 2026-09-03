-- ============================================
-- 🔧 类目格式统一修复脚本
-- 将所有产品类目格式统一为首字母大写
-- 请在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 统一类目格式为首字母大写
UPDATE products SET category = 'Electronics' WHERE LOWER(category) = 'electronics' AND category != 'Electronics';
UPDATE products SET category = 'Furniture' WHERE LOWER(category) = 'furniture' AND category != 'Furniture';
UPDATE products SET category = 'Clothing' WHERE LOWER(category) = 'clothing' AND category != 'Clothing';
UPDATE products SET category = 'Books' WHERE LOWER(category) = 'books' AND category != 'Books';
UPDATE products SET category = 'Sports' WHERE LOWER(category) = 'sports' AND category != 'Sports';
UPDATE products SET category = 'Vehicles' WHERE LOWER(category) = 'vehicles' AND category != 'Vehicles';
UPDATE products SET category = 'RealEstate' WHERE LOWER(category) IN ('real_estate', 'realestate') AND category != 'RealEstate';
UPDATE products SET category = 'Services' WHERE LOWER(category) = 'services' AND category != 'Services';
UPDATE products SET category = 'Other' WHERE category IS NULL OR category = '' OR (LOWER(category) = 'other' AND category != 'Other');

-- 2. 验证结果
SELECT category, COUNT(*) as count 
FROM products 
WHERE deleted_at IS NULL 
GROUP BY category 
ORDER BY count DESC;
