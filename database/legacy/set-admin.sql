-- =============================================
-- 设置管理员账号（2026-09 起：角色存放在 app_metadata）
-- 在 Supabase SQL Editor 中运行。请替换邮箱。
-- 注意：user_metadata 任何用户都能自己修改，绝不能用来存放角色。
-- =============================================
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || '{"role": "admin", "permissions": ["all"]}'::jsonb
WHERE email = 'your-email@example.com';

-- 验证
SELECT id, email, raw_app_meta_data->>'role' AS role
FROM auth.users
WHERE raw_app_meta_data->>'role' IS NOT NULL;

-- 撤销管理员
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'role' - 'permissions' WHERE email = 'your-email@example.com';
