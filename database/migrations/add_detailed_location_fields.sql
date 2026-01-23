-- ========================================
-- 添加镇级别位置字段到 products 表
-- ========================================
-- 执行时间: < 1秒
-- 影响: 为 products 表添加详细位置字段

-- 步骤1：添加新字段
ALTER TABLE products
ADD COLUMN IF NOT EXISTS town TEXT,
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS location_display_name TEXT;

-- 步骤2：为新字段添加注释
COMMENT ON COLUMN products.town IS '镇/村级别位置，如 "Coyoacán"';
COMMENT ON COLUMN products.district IS '区/街道级别位置，如 "Santa Monica"';
COMMENT ON COLUMN products.location_display_name IS '格式化显示名称，如 "Ciudad de México · Coyoacán"';

-- 步骤3：创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_products_town ON products(town);
CREATE INDEX IF NOT EXISTS idx_products_district ON products(district);
CREATE INDEX IF NOT EXISTS idx_products_location_display ON products(location_display_name);

-- 步骤4：验证字段已添加
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('town', 'district', 'location_display_name');

-- 步骤5：统计现有产品数据
SELECT 
    COUNT(*) as total_products,
    COUNT(town) as has_town,
    COUNT(district) as has_district,
    COUNT(location_display_name) as has_display_name
FROM products
WHERE deleted_at IS NULL;
