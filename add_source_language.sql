-- 添加产品源语言字段
-- 用于追踪产品发布时的语言，以便正确触发翻译

-- 添加 source_language 列
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS source_language VARCHAR(5) DEFAULT 'es';

-- 为现有产品设置默认值（假设大部分是西班牙语）
UPDATE products 
SET source_language = 'es' 
WHERE source_language IS NULL;

-- 添加注释
COMMENT ON COLUMN products.source_language IS '产品发布时的原始语言 (zh/en/es)';
