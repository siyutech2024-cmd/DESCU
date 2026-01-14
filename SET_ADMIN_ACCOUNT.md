# 设置管理员账号指南

由于Supabase UI可能没有直接的User Metadata编辑功能，我们使用SQL直接设置。

## 📝 步骤

### 1. 获取您的邮箱地址

首先，确认您用于登录的Google邮箱地址。

### 2. 在Supabase中运行SQL

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New Query**

### 3. 复制并执行以下SQL

**请将 `your-email@example.com` 替换为您的实际邮箱地址：**

```sql
-- 设置管理员角色
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"role": "admin", "permissions": ["all"]}'::jsonb
WHERE email = 'your-email@example.com';
```

### 4. 验证设置成功

运行以下查询验证：

```sql
-- 检查您的用户角色
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'permissions' as permissions
FROM auth.users
WHERE email = 'your-email@example.com';
```

您应该看到：
- `role`: `admin`
- `permissions`: `["all"]`

### 5. 测试登录

1. 访问管理后台登录页面：`http://localhost:5173/admin/login`
2. 点击 "使用 Google 账号登录"
3. 登录后应该能看到仪表板

---

## 🔍 如果不确定您的邮箱

运行此查询查看所有用户：

```sql
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as current_role,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

找到您的邮箱后，使用上面的UPDATE语句设置管理员角色。

---

## 🎯 快速测试

设置完成后，立即测试：

```bash
# 确保服务正在运行
# 终端1: 后端
cd server && npm run dev

# 终端2: 前端  
npm run dev

# 访问
# http://localhost:5173/admin/login
```

---

## ⚡ 完整SQL脚本

我已为您创建了完整的SQL脚本文件：

📄 **server/set-admin.sql**

此文件包含：
- 通过邮箱设置管理员
- 通过用户ID设置管理员
- 设置超级管理员
- 验证查询
- 撤销权限的方法

直接在Supabase SQL Editor中打开这个文件并执行即可！

---

## ❓ 常见问题

### Q: 执行SQL后没有变化？

A: 检查：
1. 邮箱地址是否正确（区分大小写）
2. 用户是否已经在数据库中（需要先登录一次）
3. 查询返回的影响行数是否为1

### Q: 登录后还是显示权限不足？

A: 可能需要：
1. 退出登录
2. 重新登录
3. 浏览器可能缓存了旧的Token，清除缓存或使用无痕模式

### Q: 如何设置多个管理员？

A: 对每个管理员的邮箱重复执行UPDATE语句：

```sql
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"role": "admin", "permissions": ["all"]}'::jsonb
WHERE email IN ('admin1@example.com', 'admin2@example.com');
```

---

## ✅ 完成后

管理员账号设置完成后，您可以：

1. ✅ 登录管理后台
2. ✅ 查看仪表板
3. ✅ 管理商品、用户、消息
4. ✅ 查看操作日志

继续进行Vercel和Railway部署！
