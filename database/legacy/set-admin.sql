-- =============================================
-- 设置管理员账号 SQL脚本
-- =============================================
-- 在Supabase SQL Editor中运行此脚本
-- 请将下面的邮箱地址替换为您的实际邮箱

-- 方法一：通过邮箱设置管理员（推荐）
-- 请将 'your-email@example.com' 替换为您的实际邮箱地址
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"role": "admin", "permissions": ["all"]}'::jsonb
WHERE email = 'your-email@example.com';

-- 验证设置是否成功
-- 运行以下查询检查您的用户信息
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'permissions' as permissions,
  created_at
FROM auth.users
WHERE email = 'your-email@example.com';


-- =============================================
-- 方法二：查看所有用户并设置（如果不确定邮箱）
-- =============================================

-- 第1步：查看所有用户列表
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as current_role,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 第2步：找到您的用户ID后，使用ID设置管理员
-- 将 'USER_ID_HERE' 替换为您的实际用户ID
-- UPDATE auth.users
-- SET raw_user_meta_data = 
--   COALESCE(raw_user_meta_data, '{}'::jsonb) || 
--   '{"role": "admin", "permissions": ["all"]}'::jsonb
-- WHERE id = 'USER_ID_HERE';


-- =============================================
-- 方法三：设置超级管理员（拥有所有权限）
-- =============================================

-- 将用户设置为超级管理员
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"role": "super_admin", "permissions": ["all"]}'::jsonb
WHERE email = 'your-email@example.com';


-- =============================================
-- 验证和测试
-- =============================================

-- 查看所有管理员用户
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'permissions' as permissions
FROM auth.users
WHERE raw_user_meta_data->>'role' IN ('admin', 'super_admin');


-- =============================================
-- 撤销管理员权限（如果需要）
-- =============================================

-- 移除管理员角色
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data - 'role' - 'permissions'
-- WHERE email = 'user-to-demote@example.com';
