# Vercel 详细部署指南

本指南提供在 [Vercel](https://vercel.com/) 上部署 DESCU 前端的详细图文步骤。

## 📋 准备工作

1. **拥有 Vercel 账号**: 推荐直接使用 GitHub 账号登录。
2. **代码已推送**: 确保最新的代码已推送到 GitHub 仓库 `siyutech2024-cmd/DESCU`。
3. **准备后端 URL**: 必须先部署好后端 (参考 [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)) 并获取到 URL（如 `https://descu-production.up.railway.app`）。
4. **准备数据库 Key**: Supabase 的 URL 和 Anon Key。

---

## 🚀 部署步骤

### 1. 导入项目
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)。
2. 点击右上角的 **"Add New..."** -> **"Project"**。
3. 在 "Import Git Repository" 列表中，找到 `siyutech2024-cmd/DESCU`。
4. 点击 **"Import"**。

### 2. 配置构建参数 (Build Settings)
Vercel 通常能自动识别 Vite 框架，但请务必核对以下设置：

- **Framework Preset**: 选择 `Vite`。
- **Root Directory**: 保持默认 `./` (因为 `package.json` 在根目录)。
- **Build Command**: `npm run build`。
- **Output Directory**: `dist`。

### 3. 配置环境变量 (关键步骤)
展开 **"Environment Variables"** 部分，添加以下变量：

| 变量名 | 值 (示例) | 说明 |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase Anon Key (公开 Key) |
| `VITE_API_URL` | `https://your-app.railway.app` | **后端 API 地址** (无需末尾斜杠) |

> ⚠️ **注意**: 
> 1. 不要添加 `VITE_GOOGLE_GENERATIVE_AI_API_KEY`，前端不需要它。
> 2. `VITE_API_URL` 必须填写真实的线上后端地址，**不能**填 `localhost`。

### 4. 点击部署
1. 点击底部的 **"Deploy"** 按钮。
2. 等待构建完成（通常需要 1-2 分钟）。
3. 如果看到满屏的彩带 confetti 🎉，说明部署成功！

---

## 🌐 域名配置 (可选)

### 绑定自定义域名
1. 部署完成后，点击 **"Continue to Dashboard"**。
2. 进入 **"Settings"** -> **"Domains"**。
3. 输入你想绑定的域名 (如 `descu.com`)。
4. 按照 Vercel 提示在你的域名服务商处添加 CNAME 或 A 记录。

---

## 🛠 常见问题排查

### Q: 部署失败，提示 "Command failed with exit code 1"
**A**: 点击日志查看详情。常见原因：
- TypeScript 类型错误：请确保本地运行 `npm run build` 能通过。
- 依赖缺失：检查 `package.json` 是否包含了所有必要的库。

### Q: 页面加载了，但无法注册/登录
**A**: 
1. 检查 `VITE_SUPABASE_URL` 和 `KEY` 是否正确。
2. 检查 Supabase 的 "Authentication" -> "URL Configuration" -> "Site URL" 是否设置为了你的 Vercel 域名。

### Q: 图片上传或 AI 分析失败
**A**:
1. 打开浏览器的开发者工具 (F12) -> Network 面板。
2. 检查请求的 URL 是否指向了正确的后端地址（而不是 localhost）。
3. 如果 URL 正确但报 CORS 错误，请检查**后端**代码中的 CORS 设置是否允许了 Vercel 的域名。

### Q: 样式丢失或错乱
**A**: 确保 `Build Command` 是 `npm run build` 且 `Output Directory` 是 `dist`。Tailwind CSS 需要构建过程才能生成正确的样式。
