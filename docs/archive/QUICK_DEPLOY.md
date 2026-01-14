# DESCU 快速部署清单

## ✅ 第一步：数据库迁移（必须完成）

1. 打开 Supabase Dashboard: https://supabase.com/dashboard
2. 选择您的项目
3. 点击左侧 "SQL Editor"
4. 打开 `server/admin-migration.sql` 文件
5. 复制所有内容到SQL编辑器
6. 点击 "Run" 执行

**验证**: 在 Tables 中应该能看到 `admin_logs` 表

---

## ✅ 第二步:设置管理员账号

1. 在Supabase Dashboard中
2. 进入 "Authentication" → "Users"
3. 找到您的用户（或先用Google登录一次）
4. 点击用户进入详情
5. 在 "User Metadata" 点击 "Edit"
6. 添加以下内容：

```json
{
  "role": "admin",
  "permissions": ["all"]
}
```

7. 点击 "Save"

---

## ✅ 第三步：部署前端到Vercel

### 方式一：通过Vercel网站（推荐新手）

1. 访问 https://vercel.com
2. 用GitHub账号登录
3. 点击 "Add New" → "Project"
4. 选择 `DESCU` 仓库
5. 配置：
   - Framework: **Vite**
   - Root Directory: **./** 
   - Build Command: **npm run build**
   - Output Directory: **dist**

6. 添加环境变量（点击 "Environment Variables"）:

```
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
VITE_GOOGLE_GENERATIVE_AI_API_KEY=你的Gemini API密钥
VITE_API_URL=https://你的后端域名（稍后填写）
```

7. 点击 "Deploy"

### 方式二：使用命令行

```bash
# 安装Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel

# 生产部署
vercel --prod
```

**获取前端URL**: 部署完成后，Vercel会提供一个URL，如 `https://descu-xxx.vercel.app`

---

## ✅ 第四步：部署后端到Railway

1. 访问 https://railway.app
2. 用GitHub账号登录  
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择 `DESCU` 仓库
6. 点击 "Deploy Now"
7. 部署完成后，点击项目进入详情
8. 点击 "Settings" → "Service Settings"
9. 设置：
   - **Root Directory**: `server`
   - **Start Command**: `npm start`

10. 点击 "Variables" 添加环境变量：

```
SUPABASE_URL=你的Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务密钥
GOOGLE_API_KEY=你的Gemini API密钥
PORT=3000
```

11. 点击 "Settings" → "Networking" → "Generate Domain"

**获取后端URL**: Railway会生成一个域名，如 `https://descu-production.railway.app`

---

## ✅ 第五步：更新前端环境变量

1. 回到Vercel Dashboard
2. 选择your项目
3. 进入 "Settings" → "Environment Variables"
4. 找到 `VITE_API_URL`
5. 更新为Railway提供的后端URL
6. 点击 "Save"
7. 进入 "Deployments"
8. 点击最新的部署旁边的三个点 → "Redeploy"

---

## ✅ 第六步：配置Google OAuth

1. 打开 Google Cloud Console: https://console.cloud.google.com
2. 选择您的项目
3. 进入 "APIs & Services" → "Credentials"
4. 找到您的OAuth 2.0 Client
5. 在 "Authorized redirect URIs" 添加：

```
https://你的项目ID.supabase.co/auth/v1/callback
```

6. 保存

---

## ✅ 第七步：测试部署

### 测试用户端

访问: `https://你的vercel域名/`

- [ ] 页面正常加载
- [ ] Google登录有效
- [ ] 可以浏览商品
- [ ] 可以发布商品

### 测试管理后台

访问: `https://你的vercel域名/admin/login`

- [ ] 登录页面显示正常
- [ ] 使用管理员账号登录
- [ ] 仪表板数据显示
- [ ] 可以查看商品列表

---

## 🎉 完成！

您的DESCU项目现已完全部署：

- ✅ 代码已推送到GitHub: https://github.com/siyutech2024-cmd/DESCU
- ✅ 前端部署在Vercel
- ✅ 后端部署在Railway  
- ✅ 数据库运行在Supabase
- ✅ 管理后台可访问

---

## 📞 遇到问题？

### 前端无法连接后端

检查：
- Railway服务是否正在运行
- VITE_API_URL环境变量是否正确
- 后端是否启用了CORS

### 管理后台无法登录

检查：
- 用户的role是否设置为"admin"
- 后端API是否正常运行
- 浏览器控制台的错误信息

### Google登录失败

检查：
- Google OAuth重定向URI是否包含Supabase URL
- Supabase中Google Provider是否启用

---

## 📚 更多信息

- 完整部署指南: [DEPLOYMENT_GUIDE.md](file:///Users/ishak/Downloads/descu---二手智选/DEPLOYMENT_GUIDE.md)
- 管理后台使用: [ADMIN_GUIDE.md](file:///Users/ishak/Downloads/descu---二手智选/ADMIN_GUIDE.md)
- 项目完成总结: 查看artifacts中的walkthrough.md
