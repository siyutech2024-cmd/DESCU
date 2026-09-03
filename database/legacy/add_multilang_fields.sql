-- 添加多语言翻译字段到 products 表
-- 预翻译存储方案：在产品创建/AI审核时翻译为三语言并存储

-- 添加中文字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS title_zh TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_zh TEXT;

-- 添加英文字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 添加西班牙语字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS title_es TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_es TEXT;

-- 添加注释
COMMENT ON COLUMN products.title_zh IS '中文标题（预翻译）';
COMMENT ON COLUMN products.description_zh IS '中文描述（预翻译）';
COMMENT ON COLUMN products.title_en IS '英文标题（预翻译）';
COMMENT ON COLUMN products.description_en IS '英文描述（预翻译）';
COMMENT ON COLUMN products.title_es IS '西班牙语标题（预翻译）';
COMMENT ON COLUMN products.description_es IS '西班牙语描述（预翻译）';
