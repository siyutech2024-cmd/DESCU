# 后端 API 部署指南

## 🚀 推荐平台：Railway

Railway 是最简单的 Node.js 后端部署方案，支持自动 HTTPS、环境变量管理和 GitHub 集成。

---

## 📋 部署前准备

### ✅ 确认清单
- [x] GitHub 仓库已创建：`siyutech2024-cmd/DESCU`
- [x] 后端代码在 `server/` 目录
- [x] `server/package.json` 包含 `build` 和 `start` 脚本
- [ ] Supabase 数据库已运行迁移
- [ ] 准备好所有环境变量

---

## 🛤️ Railway 部署步骤

### 1. 创建 Railway 账户

访问：https://railway.app

- 使用 GitHub 账户登录
- 授权 Railway 访问您的仓库

### 2. 创建新项目

1. 点击 **"New Project"**
2. 选择 **"Deploy from GitHub repo"**
3. 选择仓库：`siyutech2024-cmd/DESCU`
4. Railway 会自动检测到 Node.js 项目

### 3. 配置项目设置

#### a. 设置 Root Directory

**重要**：因为后端代码在 `server/` 文件夹中

1. 点击项目 → Settings
2. 找到 **"Root Directory"**
3. 输入：`server`
4. 保存

#### b. 配置构建命令

Railway 会自动检测 `package.json`，但确认以下设置：

| 配置 | 值 |
|------|-----|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Node Version | 18.x 或更高 |

### 4. 配置环境变量

在 Railway 项目中，点击 **Variables** 标签，添加以下环境变量：

#### 必需的环境变量

```bash
# 服务器端口（Railway 会自动分配，但设置默认值）
PORT=3000

# Google Gemini API Key（从 Google AI Studio 获取）
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase URL
SUPABASE_URL=https://iubhtksmswvglcqxkoqi.supabase.co

# Supabase Service Role Key（从 Supabase Dashboard 获取）
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

#### 如何获取 Supabase Service Role Key：

1. 访问：https://supabase.com/dashboard/project/iubhtksmswvglcqxkoqi/settings/api
2. 找到 **"service_role"** secret
3. 点击 👁️ 查看并复制
4. ⚠️ **永远不要**在前端使用这个 key！

### 5. 部署

1. 保存所有环境变量
2. Railway 会自动触发部署
3. 等待构建完成（通常 2-3 分钟）
4. 部署成功后，Railway 会提供一个 URL

---

## 🌐 获取后端 URL

部署完成后：

1. 在 Railway 项目中，点击 **Settings**
2. 找到 **"Domains"** 部分
3. 点击 **"Generate Domain"**
4. 您会得到一个类似这样的 URL：
   ```
   https://your-project.up.railway.app
   ```

**记下这个 URL**，需要在前端配置中使用！

---

## 🔗 连接前端和后端

### 方案 1：使用代理（推荐用于开发）

在 `vite.config.ts` 中已经配置了代理：
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    }
  }
}
```

### 方案 2：直接调用（生产环境）

如果前端部署在不同域名，需要更新 API 调用：

1. 创建环境变量配置文件
2. 在生产环境中设置：
   ```
   VITE_API_URL=https://your-project.up.railway.app
   ```
3. 更新 `services/` 中的 API 调用

---

## 🔍 测试后端 API

部署完成后，测试 API 是否正常工作：

### 1. 健康检查
```bash
curl https://your-project.up.railway.app
# 应该返回: "Venya Marketplace API is running"
```

### 2. 测试 AI 分析端点
```bash
curl -X POST https://your-project.up.railway.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"image": "base64_string_here"}'
```

### 3. 测试 Products 端点
```bash
curl https://your-project.up.railway.app/api/products
# 应该返回产品列表（如果数据库已迁移）
```

---

## 🔧 常见问题

### ❌ 构建失败

**问题**: "Cannot find module 'express'"

**解决方案**:
- 确保 Root Directory 设置为 `server`
- 确认 `server/package.json` 包含所有依赖
- 检查构建日志

### ❌ 启动失败

**问题**: "Error: Missing environment variables"

**解决方案**:
- 检查 Railway Variables 页面
- 确认所有必需的环境变量都已设置
- 重新部署

### ❌ API 请求失败

**问题**: CORS 错误

**解决方案**:
在 `server/src/index.ts` 中已配置 CORS：
```typescript
app.use(cors());
```

如果仍有问题，可以指定允许的域名：
```typescript
app.use(cors({
  origin: ['https://descu.ai', 'http://localhost:5173']
}));
```

---

## 📊 监控和日志

### 查看日志

在 Railway 项目中：
1. 点击 **Deployments**
2. 选择当前部署
3. 点击 **View Logs**

### 性能监控

Railway 提供基础监控：
- CPU 使用率
- 内存使用
- 网络流量

---

## 🔄 更新部署

### 自动部署

Railway 已连接到 GitHub：
1. 推送代码到 `main` 分支
2. Railway 自动检测更改
3. 自动构建并部署

### 手动重新部署

1. 在 Railway 项目中
2. 点击 **Deployments**
3. 点击 **Redeploy**

---

## ✅ 部署成功验证

确认以下几点：

- [ ] Railway 部署状态显示 "Active"
- [ ] 访问后端 URL 返回 "API is running"
- [ ] 环境变量全部配置正确
- [ ] API 端点测试通过
- [ ] Logs 中无错误信息

---

## 🎯 下一步

部署成功后：

1. **更新前端环境变量**
   - 在 Vercel 中设置 `VITE_API_URL`（如果需要）
   
2. **配置 CORS**
   - 确保允许来自 `https://descu.ai` 的请求

3. **测试完整流程**
   - 从前端上传商品
   - 测试 AI 分析
   - 测试聊天功能

---

## 💡 替代方案

### Render.com

1. 注册：https://render.com
2. New Web Service
3. 连接 GitHub 仓库
4. Root Directory: `server`
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`

### Heroku

1. 安装 Heroku CLI
2. `heroku login`
3. `heroku create descu-api`
4. `git subtree push --prefix server heroku main`

---

**准备好部署了吗？开始吧！** 🚀
