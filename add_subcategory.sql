-- 添加 subcategory 列到 products 表
-- 用于存储更细粒度的子类目信息

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50) DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN products.subcategory IS '子类目标识符，如 phones, laptops, cars 等';

-- 可选：创建索引以支持子类目筛选
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);

-- 可选：创建复合索引用于分类+子类目联合查询
CREATE INDEX IF NOT EXISTS idx_products_category_subcategory ON products(category, subcategory);
