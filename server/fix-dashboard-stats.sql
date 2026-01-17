-- ============================================
-- 🔧 仪表板数据同步修复脚本
-- 请在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 创建 get_total_users RPC 函数
-- 用于安全地统计 auth.users 表中的用户总数
CREATE OR REPLACE FUNCTION get_total_users()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM auth.users;
$$;

COMMENT ON FUNCTION get_total_users IS '安全获取用户总数（绕过RLS）';

-- 2. 确保 products 表有必要的列
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT false;

-- 初始化现有数据
UPDATE products SET status = 'active' WHERE status IS NULL;
UPDATE products SET views_count = 0 WHERE views_count IS NULL;

-- 3. 确保 messages 表有 deleted_at 列
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4. 确保 conversations 表有 deleted_at 列
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 5. 创建商品分类统计视图
DROP VIEW IF EXISTS admin_product_stats;
CREATE VIEW admin_product_stats AS
SELECT 
  category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
  COUNT(*) FILTER (WHERE status = 'pending_review') as pending_count,
  COUNT(*) FILTER (WHERE is_promoted = true) as promoted_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as week_count,
  AVG(price) as avg_price,
  SUM(COALESCE(views_count, 0)) as total_views
FROM products
WHERE deleted_at IS NULL
GROUP BY category;

COMMENT ON VIEW admin_product_stats IS '商品分类统计视图';

-- 6. 创建每日统计视图（包含用户统计）
DROP VIEW IF EXISTS admin_daily_stats;
CREATE VIEW admin_daily_stats AS
SELECT 
  DATE_TRUNC('day', created_at)::date as date,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as products_count,
  SUM(COALESCE(views_count, 0)) as total_views,
  0 as users_count  -- 用户统计需要从 auth.users 获取，这里暂时为0
FROM products
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW admin_daily_stats IS '每日商品统计视图';

-- 7. 授予视图访问权限
GRANT SELECT ON admin_product_stats TO authenticated;
GRANT SELECT ON admin_product_stats TO anon;
GRANT SELECT ON admin_daily_stats TO authenticated;
GRANT SELECT ON admin_daily_stats TO anon;

-- 8. 验证修复
DO $$
DECLARE
  user_count INTEGER;
  product_count INTEGER;
BEGIN
  -- 测试 get_total_users 函数
  SELECT get_total_users() INTO user_count;
  RAISE NOTICE '✅ get_total_users 函数正常，用户总数: %', user_count;
  
  -- 测试商品统计
  SELECT COUNT(*) INTO product_count FROM products WHERE deleted_at IS NULL;
  RAISE NOTICE '✅ 商品总数: %', product_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 仪表板数据同步修复完成！';
  RAISE NOTICE '请刷新管理后台仪表板页面查看数据。';
END $$;
