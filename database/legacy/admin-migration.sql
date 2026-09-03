-- 管理员后台数据库迁移脚本
-- 在 Supabase SQL Editor 中运行此脚本

-- ===============================
-- 1. 扩展 products 表
-- ===============================

-- 添加商品状态字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
COMMENT ON COLUMN products.status IS '商品状态: active, inactive, deleted, pending_review';

-- 添加软删除时间戳
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 添加浏览计数
ALTER TABLE products ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- 添加举报计数
ALTER TABLE products ADD COLUMN IF NOT EXISTS reported_count INTEGER DEFAULT 0;

-- 创建状态索引
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;

-- ===============================
-- 2. 扩展 conversations 表
-- ===============================

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at) WHERE deleted_at IS NOT NULL;

-- ===============================
-- 3. 扩展 messages 表
-- ===============================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS flag_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_flagged ON messages(is_flagged) WHERE is_flagged = true;

-- ===============================
-- 4. 创建 admin_logs 表
-- ===============================

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'ban', 'verify', 'promote', etc.
  target_type TEXT NOT NULL, -- 'product', 'user', 'conversation', 'message', etc.
  target_id TEXT NOT NULL,
  details JSONB, -- 存储操作的详细信息
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action_type);

COMMENT ON TABLE admin_logs IS '管理员操作日志表';

-- ===============================
-- 5. 创建统计视图
-- ===============================

-- 商品统计视图
CREATE OR REPLACE VIEW admin_product_stats AS
SELECT 
  category,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
  COUNT(*) FILTER (WHERE status = 'pending_review') as pending_count,
  COUNT(*) FILTER (WHERE is_promoted = true) as promoted_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as week_count,
  AVG(price) as avg_price,
  SUM(views_count) as total_views
FROM products
WHERE deleted_at IS NULL
GROUP BY category;

COMMENT ON VIEW admin_product_stats IS '商品分类统计视图';

-- 每日统计视图
CREATE OR REPLACE VIEW admin_daily_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as products_count,
  SUM(views_count) as total_views
FROM products
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW admin_daily_stats IS '每日商品统计视图';

-- ===============================
-- 6. 创建辅助函数
-- ===============================

-- 软删除商品函数
CREATE OR REPLACE FUNCTION soft_delete_product(product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET 
    deleted_at = NOW(),
    status = 'deleted'
  WHERE id = product_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION soft_delete_product IS '软删除商品';

-- 恢复已删除商品函数
CREATE OR REPLACE FUNCTION restore_product(product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET 
    deleted_at = NULL,
    status = 'active'
  WHERE id = product_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION restore_product IS '恢复已删除的商品';

-- 增加商品浏览次数函数
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET views_count = views_count + 1
  WHERE id = product_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION increment_product_views IS '增加商品浏览次数';

-- ===============================
-- 7. RLS 策略更新
-- ===============================

-- admin_logs 表的 RLS 策略（仅管理员可访问）
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（将在应用层通过Token验证管理员身份）
CREATE POLICY "管理员可以查看操作日志" ON admin_logs
  FOR SELECT USING (true);

CREATE POLICY "管理员可以插入操作日志" ON admin_logs
  FOR INSERT WITH CHECK (true);

-- ===============================
-- 8. 初始化数据
-- ===============================

-- 更新现有商品的状态（如果为NULL）
UPDATE products 
SET status = 'active' 
WHERE status IS NULL;

-- 初始化 views_count
UPDATE products 
SET views_count = 0 
WHERE views_count IS NULL;

-- 初始化 reported_count
UPDATE products 
SET reported_count = 0 
WHERE reported_count IS NULL;

-- ===============================
-- 9. 触发器设置
-- ===============================

-- 创建触发器函数：防止硬删除（强制使用软删除）
CREATE OR REPLACE FUNCTION prevent_hard_delete_products()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.deleted_at IS NULL THEN
    RAISE EXCEPTION '请使用软删除功能，不允许物理删除商品';
  END IF;
  RETURN OLD;
END;
$$;

-- 注释掉触发器，允许必要时硬删除
-- CREATE TRIGGER prevent_products_hard_delete
-- BEFORE DELETE ON products
-- FOR EACH ROW
-- EXECUTE FUNCTION prevent_hard_delete_products();

COMMENT ON FUNCTION prevent_hard_delete_products IS '防止商品被物理删除的触发器函数';

-- ===============================
-- 完成
-- ===============================

-- 验证迁移
DO $$
BEGIN
  RAISE NOTICE '管理员后台数据库迁移完成！';
  RAISE NOTICE '- products 表已扩展';
  RAISE NOTICE '- admin_logs 表已创建';
  RAISE NOTICE '- 统计视图已创建';
  RAISE NOTICE '- 辅助函数已创建';
END $$;
