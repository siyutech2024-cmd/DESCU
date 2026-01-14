# DESCU 正式环境部署指南

本指南整合了完整的正式环境部署步骤，涵盖前端 (Vercel)、后端 (Railway/Render) 和数据库 (Supabase) 的配置。

---

## 🏗 架构总览

- **前端**: React + Vite (部署于 Vercel)
- **后端**: Node.js + Express (部署于 Railway 或 Render)
- **数据库**: Supabase (PostgreSQL + Auth)
- **AI 服务**: Google Gemini (通过后端 API 调用)

---

## 📋 1. 数据库准备 (Supabase)

### 1.1 获取环境变量
登录 [Supabase Dashboard](https://supabase.com/dashboard)，进入 `Project Settings` -> `API`，获取：
- **Project URL** (`SUPABASE_URL`)
- **anon public** (`SUPABASE_ANON_KEY`) - 用于前端
- **service_role secret** (`SUPABASE_SERVICE_ROLE_KEY`) - 用于后端 (**绝对不要在前端使用**)

### 1.2 执行数据库迁移
1. 进入 `SQL Editor`。
2. 运行 `DATABASE_SCHEMA.md` 中的建表语句（如果尚未执行）。
3. 运行 `server/admin-migration.sql` 以创建管理员相关表和视图。

### 1.3 配置 Google Auth
1. 在 Supabase `server/admin-migration.sql` Authentication` -> `Providers` 中启用 Google。
2. 添加生产环境回调 URL (同时添加前端域名和后端域名，视具体的 Auth 实现而定，通常是 Supabase 的 URL):
   `https://<YOUR_PROJECT_ID>.supabase.co/auth/v1/callback`

---

## 🖥 2. 后端部署 (Railway 推荐)

> 💡 **提示**: 查看 [Railway 详细部署图文指南](docs/RAILWAY_DEPLOYMENT.md) 获取更详细的操作步骤。

### 2.1 准备工作
- 确保 Github 仓库已连接。
- 根目录为 `server/` (因为后端代码在 `server` 文件夹下)。

### 2.2 部署步骤
1. 访问 Railway 并选择 `Deploy from GitHub repo`。
2. 选择仓库 `siyutech2024-cmd/DESCU`。
3. **关键设置**:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build` (或者 `npm install && tsc`)
   - **Start Command**: `npm start`

### 2.3 配置环境变量 (Variables)
在 Railway 项目设置中添加：

| 变量名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `PORT` | 端口 | `3000` (Railway 会自动注入，但建议设置默认值) |
| `GEMINI_API_KEY` | Google AI Key | `AIzaSy...` |
| `SUPABASE_URL` | Supabase URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **后端专用**密钥 | `eyJ...` (service_role) |

### 2.4 获取后端 URL
部署成功后，Railway 会生成一个域名，例如 `https://server-production.up.railway.app`。**记录下这个 URL，前端需要用到。**

---

## 🌐 3. 前端部署 (Vercel)

> 💡 **提示**: 查看 [Vercel 详细部署图文指南](docs/VERCEL_DEPLOYMENT.md) 获取更详细的操作步骤。

### 3.1 部署步骤
1. 访问 Vercel 并选择 `Add New Project`。
2. 导入 GitHub 仓库。
3. **构建配置**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (默认)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.2 配置环境变量
在 Vercel 部署页面的 `Environment Variables` 中添加：

| 变量名 | 说明 |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key (public) |
| `VITE_API_URL` | 上一步部署好的后端 URL (不要以此斜杠结尾，如 `https://xxx.railway.app`) |

> ⚠️ **注意**: 前端**不需要** `GEMINI_API_KEY`，因为 AI 请求已通过后端代理。

### 3.3 部署与验证
1. 点击 Deploy。
2. 部署完成后，在 Vercel 仪表板中进入 **Settings -> Domains**。
3. 添加你的正式域名 `descu.ai` (Vercel 会自动添加 www 前缀)。
4. 验证 DNS 配置 (推荐使用 CNAME 或 A 记录)。
5. 测试商品发布、AI 分析和管理员登录功能。

---

## 🔧 4. 管理员账号设置

如果尚未设置管理员，请在 Supabase SQL Editor 中运行：

```sql
-- 将你的邮箱替换为实际登录邮箱
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"role": "admin", "permissions": ["all"]}'::jsonb
WHERE email = 'your-email@gmail.com';
```

## 🛠 故障排查

- **Build 失败 (后端)**: 检查 Railway Root Directory 是否设置为 `server`。
- **401 Unauthorized**: 检查 `SUPABASE_SERVICE_ROLE_KEY` 是否正确。
- **跨域 (CORS) 错误**: 检查后端 `server/src/index.ts` 中的 `cors` 配置。我们已预设了 `descu.ai`，如果你使用其他域名，请手动添加。

---
**文档维护**: 请将过时的部署文档归档至 `docs/archive/`。
