# 生产环境管理后台配置检查清单

您的网站：**https://descu.ai/admin/login**

## ✅ 第一步：确认数据库迁移已执行

### 检查 admin_logs 表是否存在

在Supabase SQL Editor中运行：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'admin_logs';
```

**如果返回空**，说明还没运行迁移，需要执行：

1. 打开 `server/admin-migration.sql`
2. 复制所有内容
3. 在Supabase SQL Editor中执行

### 检查products表的扩展字段

```sql
-- 检查products表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products'
  AND column_name IN ('status', 'deleted_at', 'views_count', 'reported_count');
```

应该返回4行数据。如果没有，说明需要运行迁移脚本。

---

## ✅ 第二步：设置管理员账号

在Supabase SQL Editor中运行（**替换成您的邮箱**）：

```sql
-- 设置管理员角色
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"role": "admin", "permissions": ["all"]}'::jsonb
WHERE email = '您的邮箱@gmail.com';

-- 验证
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'permissions' as permissions
FROM auth.users
WHERE email = '您的邮箱@gmail.com';
```

---

## ✅ 第三步：确认后端API配置

### 检查Vercel环境变量

访问 [Vercel Dashboard](https://vercel.com/dashboard) → 选择您的项目 → Settings → Environment Variables

确认以下变量已设置：

```
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的匿名密钥
VITE_GOOGLE_GENERATIVE_AI_API_KEY=你的Gemini密钥
VITE_API_URL=https://你的后端域名（Railway或其他）
```

**重要**: `VITE_API_URL` 必须指向您的后端服务

### 检查Railway后端配置

访问 [Railway Dashboard](https://railway.app/dashboard) → 选择您的项目

确认：
1. **Root Directory** = `server`
2. **Start Command** = `npm start`
3. 环境变量已设置：
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   GOOGLE_API_KEY=...
   PORT=3000
   ```

---

## ✅ 第四步：测试后端API

### 测试健康检查

```bash
curl https://你的后端域名/
```

应该返回：`DESCU Marketplace API is running`

### 测试管理员API（需要先登录获取Token）

1. 访问 https://descu.ai/admin/login
2. 使用Google登录
3. 打开浏览器开发者工具（F12）
4. 在Console中运行：

```javascript
// 获取Token
const token = (await supabase.auth.getSession()).data.session.access_token;

// 测试管理员API
fetch('https://你的后端域名/api/admin/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(r => r.json()).then(console.log);
```

如果返回您的管理员信息（email, role），说明配置正确！

---

## ✅ 第五步：更新部署代码

### 如果刚才推送的代码还没部署

1. **Vercel会自动部署**
   - 访问 Vercel Dashboard
   - 查看 Deployments
   - 最新的部署应该包含管理后台代码

2. **如果还是旧版本**
   - 点击 Deployments → 最新部署 → "Redeploy"

3. **Railway也会自动部署**
   - 访问 Railway Dashboard
   - 查看最新部署状态

---

## 🔍 常见问题排查

### 问题1：访问 /admin/login 显示404

**原因**: 可能是路由配置问题

**解决**:
1. 确认 `RootApp.tsx` 已部署
2. 确认 Vercel 配置中的 rewrites 正确
3. 检查 `vercel.json` 配置

### 问题2：登录后显示"权限不足"

**原因**: 用户没有admin角色

**解决**:
1. 在Supabase中执行设置管理员的SQL
2. 退出登录，清除浏览器缓存
3. 重新登录

### 问题3：仪表板数据不显示

**原因**: 后端API连接问题

**解决**:
1. 检查 `VITE_API_URL` 环境变量
2. 确认后端服务正在运行
3. 检查CORS配置
4. 查看浏览器Console的错误信息

### 问题4：API返回401错误

**原因**: Token验证失败

**解决**:
1. 确认后端有正确的 `SUPABASE_SERVICE_ROLE_KEY`
2. 确认前后端使用同一个Supabase项目
3. 重新登录获取新Token

---

## 🎯 完整验证流程

按顺序执行：

```bash
# 1. 检查生产环境前端
curl -I https://descu.ai/

# 2. 检查后端API
curl https://你的后端域名/

# 3. 检查管理后台路由
curl -I https://descu.ai/admin/login
```

所有请求都应该返回 200 OK

---

## 📞 需要帮助？

如果遇到问题，请提供：

1. 访问 https://descu.ai/admin/login 时的错误信息
2. 浏览器Console的错误日志（F12 → Console）
3. Network标签中API请求的状态

我可以帮您具体排查！

---

## ✨ 部署成功后

您应该能够：

1. ✅ 访问 https://descu.ai/admin/login
2. ✅ 使用Google账号登录
3. ✅ 看到管理后台仪表板
4. ✅ 查看商品、用户、消息数据
5. ✅ 执行管理操作

祝部署成功！🎉
