# Vercel Serverless Functions 配置指南

您的后端使用Vercel Serverless Functions，这是最简单的部署方式！

---

## 🎯 当前状态分析

您的项目结构：
- ✅ 前端在 Vercel
- ✅ 后端Express代码在 `server/` 目录
- ❓ 需要将Express转换为Vercel Functions

---

## 📋 两种方案

### 方案一：使用现有Express后端（推荐快速部署）

**直接部署到Railway**，然后在Vercel中配置代理：

1. ✅ 简单快速
2. ✅ 无需修改代码
3. ✅ 按照 BACKEND_DEPLOYMENT.md 部署

### 方案二：转换为Vercel Serverless Functions

**重构后端为Vercel Functions**：

1. ⚠️ 需要重写所有API
2. ✅ 完全托管在Vercel
3. ⚠️ 有执行时间限制

---

## 🚀 推荐方案：快速配置

### 步骤1：确认后端是否已部署

访问您的Vercel项目设置，查看是否已经配置了API routes。

### 步骤2：检查Vercel配置

打开Vercel Dashboard → 您的项目 → Settings → Functions

查看是否有API endpoints列表。

### 步骤3：测试API

```bash
# 测试您的API是否在运行
curl https://descu.ai/api/products
```

---

## ✅ 如果API已经工作

如果上面的测试返回了数据，说明后端已经配置好了！

只需要：

1. **运行数据库迁移**
   ```sql
   -- 在Supabase中执行
   -- 复制 server/admin-migration.sql 的内容
   ```

2. **设置管理员账号**
   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = 
     COALESCE(raw_user_meta_data, '{}'::jsonb) || 
     '{"role": "admin", "permissions": ["all"]}'::jsonb
   WHERE email = '您的邮箱@gmail.com';
   ```

3. **访问管理后台**
   ```
   https://descu.ai/admin/login
   ```

---

## ⚙️ 快速验证

### 测试1：检查API健康状态

```bash
curl https://descu.ai/api/
# 或者
curl https://descu.ai/
```

### 测试2：检查管理员路由

在浏览器中访问：
```
https://descu.ai/admin/login
```

应该看到登录页面。

### 测试3：检查API调用

登录后，打开浏览器开发者工具（F12），查看Network标签，看API请求是否成功。

---

## 🔧 如果API不工作

### 检查Vercel配置

1. 访问 Vercel Dashboard
2. 选择您的项目
3. 查看 Settings → Environment Variables
4. 确认是否设置了API相关的环境变量

### 检查vercel.json

您当前的 `vercel.json` 配置指向：
```json
{
  "rewrites": [{
    "source": "/api/:path*",
    "destination": "YOUR_BACKEND_URL/api/:path*"
  }]
}
```

**需要更新 `YOUR_BACKEND_URL`** 或者删除这个配置。

---

## 💡 立即行动方案

### 选项A：最快方案（推荐）

1. **部署后端到Railway**
   - 5分钟内完成
   - 无需修改代码
   - 参考 `BACKEND_DEPLOYMENT.md`

2. **更新 vercel.json**
   ```json
   {
     "rewrites": [{
       "source": "/api/:path*",
       "destination": "https://你的railway域名/api/:path*"
     }]
   }
   ```

3. **推送并部署**
   ```bash
   git add vercel.json
   git commit -m "配置API代理到Railway"
   git push
   ```

### 选项B：完全Vercel方案

如果您希望完全使用Vercel，我可以帮您：

1. 创建 Vercel Serverless Functions
2. 迁移所有API endpoints
3. 配置数据库连接

**但这需要更多时间（2-3小时）**

---

## ❓ 请告诉我

1. 您访问 `https://descu.ai/api/products` 返回什么？
2. 您希望使用哪个方案？
   - **A**: Railway（快速，5分钟）
   - **B**: 完全Vercel（慢，需要重构）

根据您的回答，我可以提供更具体的指导！

---

## 📝 临时解决方案

如果您只想先让管理后台登录功能工作：

1. 数据库迁移（必须）
2. 设置管理员账号（必须）
3. 访问 https://descu.ai/admin/login

登录功能应该能正常工作，即使数据暂时不显示。

先试试这个，然后我们再配置完整的API！
