-- 产品翻译缓存表
-- 用于存储已翻译的产品内容，避免重复调用AI API

CREATE TABLE IF NOT EXISTS product_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('zh', 'en', 'es')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个产品的每种语言只有一条翻译记录
  UNIQUE(product_id, language)
);

-- 索引优化：按产品ID和语言快速查询
CREATE INDEX IF NOT EXISTS idx_product_translations_product_lang 
ON product_translations(product_id, language);

-- 索引优化：按更新时间查询（用于清理过期缓存）
CREATE INDEX IF NOT EXISTS idx_product_translations_updated 
ON product_translations(updated_at);

-- 添加注释
COMMENT ON TABLE product_translations IS '产品内容翻译缓存表，存储AI翻译结果';
COMMENT ON COLUMN product_translations.product_id IS '关联的产品ID';
COMMENT ON COLUMN product_translations.language IS '目标语言代码 (zh/en/es)';
COMMENT ON COLUMN product_translations.title IS '翻译后的标题';
COMMENT ON COLUMN product_translations.description IS '翻译后的描述';
COMMENT ON COLUMN product_translations.updated_at IS '缓存更新时间，用于判断是否需要重新翻译';

-- 触发器：产品更新时清除对应的翻译缓存
-- 确保商品编辑后，翻译会重新生成
CREATE OR REPLACE FUNCTION clear_product_translation_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果标题或描述发生变化，删除所有语言的翻译缓存
  IF (OLD.title IS DISTINCT FROM NEW.title) OR 
     (OLD.description IS DISTINCT FROM NEW.description) THEN
    DELETE FROM product_translations WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clear_translation_cache
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION clear_product_translation_cache();

-- RLS策略：翻译缓存表的访问控制
ALTER TABLE product_translations ENABLE ROW LEVEL SECURITY;

-- 策略1：所有人可读（翻译结果是公开的）
CREATE POLICY "翻译缓存公开可读"
ON product_translations
FOR SELECT
USING (true);

-- 策略2：只允许服务端插入/更新（通过service role key）
CREATE POLICY "仅服务端可写翻译缓存"
ON product_translations
FOR ALL
USING (false)
WITH CHECK (false);
