# DESCU 二手智选 - 完整设置指南

## 📋 所需 API 密钥和配置

### 1. Gemini API Key (AI 图片分析)
**在哪里获取：**
- 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
- 登录您的 Google 账户
- 点击 "Create API Key"
- 复制生成的 API Key

**用途：** 用于分析用户上传的商品图片，自动生成标题和描述

---

### 2. Supabase 配置
**在哪里获取：**
1. 访问 [Supabase](https://supabase.com)
2. 创建新项目（或使用现有项目）
3. 在项目设置中找到以下信息：

**项目设置 → API:**
- `SUPABASE_URL`: 您的项目 URL（例如：`https://xxxxx.supabase.co`）
- `SUPABASE_ANON_KEY`: anon/public key（用于前端）
- `SUPABASE_SERVICE_ROLE_KEY`: service_role key（用于后端，**保密！**）

---

## 🚀 设置步骤

### 步骤 1: 配置 Supabase 数据库

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 复制 `server/supabase-migration.sql` 的内容
4. 粘贴到 SQL Editor 并运行
5. 确认表已创建（products, conversations, messages）

### 步骤 2: 配置后端环境变量

1. 进入 `server/` 目录
2. 复制 `.env.example` 为 `.env`：
   ```bash
   cd server
   cp .env.example .env
   ```
3. 编辑 `.env` 文件，填入真实的密钥：
   ```
   PORT=3000
   GEMINI_API_KEY=你的_gemini_api_key
   SUPABASE_URL=你的_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=你的_supabase_service_role_key
   ```

### 步骤 3: 配置前端环境变量

1. 在项目根目录创建 `.env.local` 文件
2. 添加以下内容：
   ```
   VITE_SUPABASE_URL=你的_supabase_url
   VITE_SUPABASE_ANON_KEY=你的_supabase_anon_key
   ```

### 步骤 4: 安装依赖

**后端依赖：**
```bash
cd server
npm install
```

**前端依赖：**
```bash
cd ..
npm install
```

### 步骤 5: 启动应用

**终端 1 - 启动后端：**
```bash
cd server
npm run dev
```
后端将运行在 `http://localhost:3000`

**终端 2 - 启动前端：**
```bash
npm run dev
```
前端将运行在 `http://localhost:5173`

---

## 📁 项目结构

```
descu---二手智选/
├── server/                    # 后端代码
│   ├── src/
│   │   ├── index.ts          # 服务器入口
│   │   └── controllers/
│   │       ├── aiController.ts       # AI 分析控制器
│   │       └── productController.ts  # 产品 CRUD 控制器
│   ├── .env                  # 后端环境变量（需创建）
│   ├── .env.example          # 环境变量示例
│   ├── package.json
│   └── supabase-migration.sql # 数据库迁移脚本
├── services/
│   ├── supabase.ts           # Supabase 客户端（前端）
│   └── geminiService.ts      # Gemini API 调用（现在使用后端）
├── .env.local                # 前端环境变量（需创建）
└── package.json
```

---

## 🔧 API 端点

### POST /api/analyze
分析图片并生成商品信息
```json
{
  "image": "base64_encoded_image",
  "language": "zh" | "en" | "es"
}
```

### POST /api/products
创建新商品
```json
{
  "seller": { ... },
  "title": "商品标题",
  "description": "描述",
  "price": 100,
  ...
}
```

### GET /api/products
获取所有商品列表

---

## ✅ 验证设置

1. 启动后端和前端
2. 访问 `http://localhost:5173`
3. 点击 "Sell" 按钮上传图片
4. 确认 AI 自动生成了标题和描述
5. 提交商品后，在 Supabase Dashboard → Table Editor 中查看 `products` 表

---

## 🔒 安全提示

- ❌ **不要**将 `.env` 文件提交到 Git
- ❌ **不要**在前端使用 `SUPABASE_SERVICE_ROLE_KEY`
- ✅ 使用 `.gitignore` 排除敏感文件
- ✅ `SUPABASE_SERVICE_ROLE_KEY` 仅用于后端

---

## 🆘 常见问题

**Q: 前端报错 "Failed to analyze image"**
- 检查后端是否运行
- 检查 `GEMINI_API_KEY` 是否正确
- 查看后端控制台错误日志

**Q: 无法保存商品到数据库**
- 确认 Supabase 迁移脚本已运行
- 检查 `SUPABASE_SERVICE_ROLE_KEY` 是否正确
- 在 Supabase Dashboard 查看表是否存在

**Q: CORS 错误**
- 已在后端配置 CORS，应该不会出现
- 如果出现，检查前端是否正确代理到 `localhost:3000`
