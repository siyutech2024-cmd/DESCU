# DESCU - GitHub 部署指南

## 📦 部署前准备

### 1. 确保 .gitignore 正确配置

检查 `.gitignore` 文件包含以下内容：
```
.env
.env.local
server/.env
server/.env.local
node_modules
dist
build
```

### 2. 验证环境变量文件已创建

确保您有以下示例文件（不包含真实密钥）：
- `.env.example`
- `server/.env.example`

---

## 🚀 部署到 GitHub 步骤

### 步骤 1: 初始化 Git 仓库（如果尚未初始化）

```bash
cd /Users/ishak/Downloads/descu---二手智选
git init
```

### 步骤 2: 添加所有文件

```bash
git add .
```

### 步骤 3: 创建首次提交

```bash
git commit -m "Initial commit: DESCU marketplace with Supabase and Google OAuth"
```

### 步骤 4: 在 GitHub 创建新仓库

1. 访问 [GitHub](https://github.com/new)
2. 创建新仓库:
   - 仓库名称: `descu`
   - 描述: "Modern marketplace with AI, real-time chat, and Google OAuth"
   - Public 或 Private（根据需要选择）
   - **不要**勾选 "Initialize this repository with README"
3. 点击 "Create repository"

### 步骤 5: 连接本地仓库到 GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/descu.git
```

### 步骤 6: 推送代码

```bash
git branch -M main
git push -u origin main
```

---

## 🔐 重要安全提示

### ⚠️ 在推送前检查

运行以下命令确保敏感文件未被追踪：

```bash
git status
```

确认以下文件**不在**待提交列表中：
- `.env`
- `.env.local`
- `server/.env`
- 任何包含真实 API 密钥的文件

### 如果意外提交了敏感文件

```bash
# 从 Git 历史中移除文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 强制推送
git push origin --force --all
```

---

## 🌐 生产环境部署

### 前端部署 (Vercel 推荐)

1. **连接 GitHub**
   - 访问 [Vercel](https://vercel.com)
   - 导入 GitHub 仓库

2. **配置环境变量**
   - `VITE_SUPABASE_URL`: 您的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase 匿名密钥

3. **构建设置**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **部署**
   - 点击 "Deploy"

### 后端部署 (Railway 推荐)

1. **连接 GitHub**
   - 访问 [Railway](https://railway.app)
   - New Project → Deploy from GitHub repo

2. **配置环境变量**
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **构建设置**
   - Root Directory: `server`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **配置 package.json**
   
   在 `server/package.json` 中添加:
   ```json
   "scripts": {
     "start": "node dist/index.js",
     "build": "tsc"
   }
   ```

---

## 📝 推荐的 Git 工作流

### 日常开发

```bash
# 创建新功能分支
git checkout -b feature/new-feature

# 开发并提交
git add .
git commit -m "Add: new feature description"

# 推送到 GitHub
git push origin feature/new-feature

# 在 GitHub 创建 Pull Request
```

### 合并到主分支

```bash
git checkout main
git merge feature/new-feature
git push origin main
```

---

## 🔄 持续集成/部署 (CI/CD)

### GitHub Actions 示例

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      # 前端构建
      - name: Install Frontend Dependencies
        run: npm install
      
      - name: Build Frontend
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      
      # 后端构建
      - name: Install Backend Dependencies
        run: cd server && npm install
      
      - name: Build Backend
        run: cd server && npm run build
```

---

## ✅ 部署检查清单

部署前确认：

- [ ] `.gitignore` 已更新，排除敏感文件
- [ ] `.env.example` 文件已创建
- [ ] `README.md` 已更新
- [ ] 所有密钥使用环境变量
- [ ] 本地测试通过
- [ ] 数据库迁移脚本已准备好
- [ ] Google OAuth redirect URI 已更新
- [ ] Supabase Row Level Security 已配置

---

## 🆘 常见问题

### 问题 1: 推送被拒绝

```bash
git pull origin main --rebase
git push origin main
```

### 问题 2: 大文件无法推送

使用 Git LFS:
```bash
git lfs install
git lfs track "*.png"
git add .gitattributes
git commit -m "Add Git LFS"
```

### 问题 3: 环境变量在生产环境不生效

确保在部署平台（Vercel/Railway）的设置中添加了所有环境变量。

---

## 📚 相关文档

- [GitHub 官方文档](https://docs.github.com)
- [Vercel 部署指南](https://vercel.com/docs)
- [Railway 部署指南](https://docs.railway.app)
- [Supabase 生产环境配置](https://supabase.com/docs/guides/platform/going-into-prod)

---

完成！您的代码现在可以安全地推送到 GitHub 并部署到生产环境了。
