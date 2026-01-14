# DESCU 项目部署指南

本指南将帮助您将DESCU项目同步到GitHub并部署到Vercel。

---

## 📋 准备工作

### 1. 确保环境变量配置正确

检查 `.env.local` 文件包含以下内容：

```env
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
VITE_GOOGLE_GENERATIVE_AI_API_KEY=你的Gemini API密钥
VITE_API_URL=http://localhost:3000
```

### 2. 确保后端环境变量配置

检查 `server/.env` 文件：

```env
SUPABASE_URL=你的Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务密钥
GOOGLE_API_KEY=你的Gemini API密钥
PORT=3000
```

---

## 🚀 第一步：同步到GitHub

### 1. 初始化Git仓库（如果还没有）

```bash
cd /Users/ishak/Downloads/descu---二手智选

# 初始化Git（如果还没有.git目录）
git init

# 查看当前状态
git status
```

### 2. 添加所有文件到Git

```bash
# 添加所有文件
git add .

# 提交
git commit -m "feat: 添加管理员后台系统

- 实现完整的管理后台功能
- 添加仪表板、商品管理、用户管理、消息监控
- 集成Supabase认证和数据库
- 添加操作日志和审计功能"
```

### 3. 创建GitHub仓库并推送

#### 方式一：通过GitHub网站创建

1. 访问 [GitHub](https://github.com)
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `descu-marketplace`
   - Description: `DESCU二手交易平台 - 全栈应用`
   - Public 或 Private（根据需要选择）
   - **不要**勾选 "Initialize with README"
4. 点击 "Create repository"

5. 在本地执行：

```bash
# 添加远程仓库（替换成你的GitHub用户名）
git remote add origin https://github.com/你的用户名/descu-marketplace.git

# 推送到GitHub
git branch -M main
git push -u origin main
```

#### 方式二：使用GitHub CLI

```bash
# 安装GitHub CLI（如果还没有）
brew install gh

# 登录GitHub
gh auth login

# 创建仓库并推送
gh repo create descu-marketplace --public --source=. --remote=origin --push
```

### 4. 验证推送成功

访问你的GitHub仓库页面，确认所有文件已上传。

---

## 🌐 第二步：部署前端到Vercel

### 1. 准备Vercel部署

确保项目根目录有 `vercel.json` 配置文件（已存在）

### 2. 部署到Vercel

#### 方式一：通过Vercel网站（推荐）

1. 访问 [Vercel](https://vercel.com)
2. 使用GitHub账号登录
3. 点击 "Add New" → "Project"
4. 从GitHub导入刚才创建的仓库
5. 配置项目：
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (保持默认)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

6. 添加环境变量（Environment Variables）：
   ```
   VITE_SUPABASE_URL=你的Supabase项目URL
   VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
   VITE_GOOGLE_GENERATIVE_AI_API_KEY=你的Gemini API密钥
   VITE_API_URL=你的后端API地址（稍后配置）
   ```

7. 点击 "Deploy" 开始部署

#### 方式二：使用Vercel CLI

```bash
# 安装Vercel CLI
npm install -g vercel

# 登录Vercel
vercel login

# 部署
vercel

# 按提示操作，选择：
# - Set up and deploy? Yes
# - Which scope? 选择你的账号
# - Link to existing project? No
# - Project name? descu-marketplace
# - Directory? ./ (直接回车)
# - Override settings? No

# 部署到生产环境
vercel --prod
```

### 3. 配置自定义域名（可选）

在Vercel项目设置中：
1. 进入 "Settings" → "Domains"
2. 添加你的自定义域名
3. 按照提示配置DNS记录

---

## 🖥️ 第三步：部署后端到Railway/Render

### 选项A：部署到Railway（推荐）

1. 访问 [Railway](https://railway.app)
2. 使用GitHub账号登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择你的 `descu-marketplace` 仓库
6. 配置：
   - **Root Directory**: `server`
   - **Start Command**: `npm start`

7. 添加环境变量：
   ```
   SUPABASE_URL=你的Supabase项目URL
   SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务密钥
   GOOGLE_API_KEY=你的Gemini API密钥
   PORT=3000
   ```

8. 部署后，Railway会提供一个URL（如 `https://your-app.railway.app`）

9. 将这个URL更新到Vercel的环境变量 `VITE_API_URL`

### 选项B：部署到Render

1. 访问 [Render](https://render.com)
2. 使用GitHub账号登录
3. 点击 "New" → "Web Service"
4. 连接GitHub仓库
5. 配置：
   - **Name**: descu-api
   - **Environment**: Node
   - **Region**: 选择离你最近的区域
   - **Branch**: main
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

6. 添加环境变量（同Railway）

7. 点击 "Create Web Service"

---

## 🗄️ 第四步：运行数据库迁移

### 1. 在Supabase中运行迁移

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击 "SQL Editor"
4. 新建查询
5. 复制 `server/admin-migration.sql` 的内容
6. 粘贴并运行

### 2. 设置管理员账号

在Supabase Dashboard中：
1. 进入 "Authentication" → "Users"
2. 找到你的用户
3. 编辑 User Metadata，添加：

```json
{
  "role": "admin",
  "permissions": ["all"]
}
```

---

## 🔧 第五步：配置Google OAuth

### 1. 在Google Cloud Console配置

添加生产环境的重定向URI：

```
https://你的项目ID.supabase.co/auth/v1/callback
```

### 2. 在Supabase中配置

1. 进入Supabase Dashboard
2. "Authentication" → "Providers"
3. 启用Google Provider
4. 输入Google Client ID和Client Secret
5. 保存

---

## ✅ 第六步：验证部署

### 1. 测试前端

访问你的Vercel域名，测试：
- [ ] 主页加载正常
- [ ] Google登录功能
- [ ] 商品浏览功能
- [ ] 发布商品功能

### 2. 测试管理后台

访问 `https://你的域名/admin/login`，测试：
- [ ] 管理员登录
- [ ] 仪表板数据显示
- [ ] API调用正常

### 3. 测试后端API

```bash
# 测试健康检查
curl https://你的后端URL/

# 测试管理员API（需要Token）
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://你的后端URL/api/admin/dashboard/stats
```

---

## 🔄 后续更新流程

### 1. 本地开发

```bash
# 创建新功能分支
git checkout -b feature/new-feature

# 开发并提交
git add .
git commit -m "feat: 添加新功能"

# 推送到GitHub
git push origin feature/new-feature
```

### 2. 合并到主分支

```bash
# 切换到主分支
git checkout main

# 合并功能分支
git merge feature/new-feature

# 推送（将自动触发Vercel和Railway重新部署）
git push origin main
```

### 3. 自动部署

- **Vercel**: 每次推送到main分支自动部署前端
- **Railway/Render**: 每次推送自动部署后端

---

## 📊 监控和日志

### Vercel

- 访问 [Vercel Dashboard](https://vercel.com/dashboard)
- 查看部署日志和运行时日志
- 监控网站性能

### Railway

- 访问 [Railway Dashboard](https://railway.app/dashboard)
- 查看服务日志
- 监控CPU和内存使用

### Supabase

- 访问 [Supabase Dashboard](https://supabase.com/dashboard)
- 查看数据库性能
- 监控API使用情况
- 查看认证日志

---

## 🐛 常见问题

### Q: Vercel部署失败

**A**: 检查：
1. 构建命令是否正确: `npm run build`
2. 环境变量是否都已配置
3. 查看构建日志找到具体错误

### Q: 后端API无法访问

**A**: 检查：
1. Railway/Render服务是否正在运行
2. 环境变量是否配置正确
3. 端口配置是否正确（Railway会自动分配端口）

### Q: Google登录不工作

**A**: 检查：
1. Google OAuth重定向URI是否包含生产环境URL
2. Supabase中Google Provider是否启用
3. Client ID和Secret是否正确

### Q: 管理后台无法访问

**A**: 检查：
1. 用户是否设置了admin角色
2. 后端API URL是否正确配置
3. CORS配置是否允许前端域名

---

## 📞 快速命令参考

```bash
# 本地开发
npm run dev                    # 启动前端
cd server && npm run dev       # 启动后端

# Git操作
git status                     # 查看状态
git add .                      # 添加所有更改
git commit -m "消息"           # 提交
git push                       # 推送

# Vercel
vercel                         # 预览部署
vercel --prod                  # 生产部署
vercel env pull                # 拉取环境变量

# Railway CLI
railway login                  # 登录
railway up                     # 部署
railway logs                   # 查看日志
```

---

## 🎉 完成！

恭喜！你的DESCU项目现在已经：
- ✅ 同步到GitHub
- ✅ 前端部署到Vercel
- ✅ 后端部署到Railway/Render
- ✅ 数据库运行在Supabase
- ✅ 管理后台可以访问

享受你的全栈应用吧！
