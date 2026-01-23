-- 产品翻译缓存表
-- 用于存储已翻译的产品内容，避免重复调用AI API

-- 创建表（如果不存在）
CREATE TABLE IF NOT EXISTS product_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('zh', 'en', 'es')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, language)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_product_translations_product_lang 
ON product_translations(product_id, language);

CREATE INDEX IF NOT EXISTS idx_product_translations_updated 
ON product_translations(updated_at);

-- 删除可能存在的旧触发器（使用不同函数名）
DROP TRIGGER IF EXISTS trigger_clear_translation_cache ON products;

-- 创建或替换函数
CREATE OR REPLACE FUNCTION clear_translation_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.title IS DISTINCT FROM NEW.title) OR 
     (OLD.description IS DISTINCT FROM NEW.description) THEN
    DELETE FROM product_translations WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trigger_clear_translation_cache
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION clear_translation_cache();

-- RLS策略
ALTER TABLE product_translations ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "翻译缓存公开可读" ON product_translations;
DROP POLICY IF EXISTS "仅服务端可写翻译缓存" ON product_translations;

-- 重新创建策略
CREATE POLICY "翻译缓存公开可读"
ON product_translations FOR SELECT USING (true);

CREATE POLICY "仅服务端可写翻译缓存"
ON product_translations FOR ALL
USING (false) WITH CHECK (false);

-- 添加注释
COMMENT ON TABLE product_translations IS '产品内容翻译缓存表';