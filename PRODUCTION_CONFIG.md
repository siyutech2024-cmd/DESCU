# 生产环境配置说明

## 🌐 API URL 配置

### 当前部署状态
- **前端**: https://descu.ai
- **后端**: 待部署

---

## 📝 配置方案

### 方案 1：前后端同域名（推荐）

如果后端也部署到 `descu.ai` 的子路径（如 `descu.ai/api`）：

**无需额外配置**，代码会自动使用相对路径。

#### Vercel 配置
在 `vercel.json` 中添加重写规则：
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend-url.railway.app/api/:path*"
    }
  ]
}
```

---

### 方案 2：后端独立域名

如果后端部署到独立 URL（如 Railway）：

#### 1. 获取后端 URL
部署后端到 Railway，获取 URL，例如：
```
https://descu-api.up.railway.app
```

#### 2. 配置 Vercel 环境变量

在 Vercel 项目设置中添加：
```
VITE_API_URL=https://descu-api.up.railway.app
```

#### 3. 重新部署前端
环境变量更新后，触发 Vercel 重新部署。

---

## 🔧 Vercel 部署配置

### 环境变量（必需）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_SUPABASE_URL` | `https://iubhtksmswvglcqxkoqi.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `your_anon_key` | Supabase 匿名密钥 |
| `VITE_API_URL` | `https://backend-url` | 后端 API URL（可选） |

### 构建设置

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

---

## 🔗 CORS 配置

如果使用独立后端域名，需要在后端配置 CORS。

### 更新 server/src/index.ts

```typescript
app.use(cors({
  origin: [
    'https://descu.ai',
    'http://localhost:5173'  // 开发环境
  ],
  credentials: true
}));
```

---

## ✅ 验证配置

部署完成后，测试以下端点：

```bash
# 1. 测试首页
curl https://descu.ai

# 2. 测试 API（通过前端代理）
curl https://descu.ai/api/products

# 3. 直接测试后端（如果独立部署）
curl https://your-backend.railway.app/api/products
```

---

## 📊 推荐架构

### 选项 A：Vercel + Railway（推荐）

```
用户请求 → https://descu.ai
    ↓
Vercel (前端)
    ↓
/api/* → 重写到 Railway 后端
    ↓
Railway (后端 API)
    ↓
Supabase (数据库)
```

**优点**：
- 完全独立部署
- 可以单独扩展后端
- 清晰的职责分离

### 选项 B：Vercel Serverless Functions

将后端 API 改造为 Vercel Serverless Functions。

**优点**：
- 同域名，无 CORS 问题
- 统一部署

**缺点**：
- 需要重构后端代码
- 受 Vercel 限制（执行时间、内存等）

---

## 🚀 快速部署步骤

1. **部署后端到 Railway**
   - 参考 `BACKEND_DEPLOYMENT.md`
   - 获取后端 URL

2. **配置 Vercel 环境变量**
   - 添加 `VITE_API_URL`（后端 URL）
   - 添加 Supabase 相关变量

3. **创建 vercel.json**（如果使用代理）
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-backend.railway.app/api/:path*"
       }
     ]
   }
   ```

4. **推送到 GitHub**
   - Git 会自动触发 Vercel 部署

5. **测试**
   - 访问 https://descu.ai
   - 测试登录、上传商品、聊天等功能

---

## 📝 环境变量完整清单

### Vercel（前端）
```bash
VITE_SUPABASE_URL=https://iubhtksmswvglcqxkoqi.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=https://your-backend.railway.app  # 可选
```

### Railway（后端）
```bash
PORT=3000
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://iubhtksmswvglcqxkoqi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

**完成配置后，您的应用将在 https://descu.ai 完全正常工作！** 🎉
