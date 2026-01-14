-- 数据库健康检查脚本
-- 在 Supabase SQL Editor 中运行此脚本

DO $$
DECLARE
    missing_items TEXT[] := ARRAY[]::TEXT[];
    table_check BOOLEAN;
    view_check BOOLEAN;
    function_check BOOLEAN;
BEGIN
    -- 1. 检查表是否存在
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_logs') INTO table_check;
    IF NOT table_check THEN missing_items := array_append(missing_items, 'Table: admin_logs'); END IF;

    -- 2. 检查视图是否存在
    SELECT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'admin_product_stats') INTO view_check;
    IF NOT view_check THEN missing_items := array_append(missing_items, 'View: admin_product_stats'); END IF;

    SELECT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'admin_daily_stats') INTO view_check;
    IF NOT view_check THEN missing_items := array_append(missing_items, 'View: admin_daily_stats'); END IF;

    -- 3. 检查函数是否存在
    SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'soft_delete_product') INTO function_check;
    IF NOT function_check THEN missing_items := array_append(missing_items, 'Function: soft_delete_product'); END IF;

    -- 4. 检查是否有管理员用户
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin' OR raw_user_meta_data->>'role' = 'super_admin'
    ) THEN
        missing_items := array_append(missing_items, 'Data: No Admin User Found');
    END IF;

    -- 5. 输出结果
    IF array_length(missing_items, 1) > 0 THEN
        RAISE EXCEPTION '❌ 健康检查失败，缺少以下项目: %', missing_items;
    ELSE
        RAISE NOTICE '✅ 数据库健康检查通过！所有核心后台表和函数均已就绪。';
    END IF;
END $$;
