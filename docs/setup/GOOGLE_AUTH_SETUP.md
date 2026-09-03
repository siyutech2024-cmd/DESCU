# Google OAuth 登录配置指南

## 🔑 需要的 API 凭据

从 Google Cloud Console 获取：
1. **Google OAuth Client ID**
2. **Google OAuth Client Secret**

---

## 📝 详细配置步骤

### 1️⃣ 在 Google Cloud Console 创建 OAuth 凭据

**访问**: https://console.cloud.google.com/

#### a) 创建新项目
1. 点击顶部项目选择器 → **新建项目**
2. 项目名称: `DESCU Marketplace`
3. 点击 **创建**

#### b) 启用必要的 API
1. 左侧菜单: **API 和服务** → **库**
2. 搜索 `Google+ API` 或 `Google People API`
3. 点击并 **启用**

#### c) 配置 OAuth 同意屏幕
1. 左侧菜单: **API 和服务** → **OAuth 同意屏幕**
2. 用户类型: **外部** → **创建**
3. 填写以下信息:
   - **应用名称**: DESCU
   - **用户支持电子邮件**: 您的邮箱
   - **应用首页**: `http://localhost:5173`
   - **授权域**: 留空（开发时）
   - **开发者联系信息**: 您的邮箱
4. 点击 **保存并继续** → **保存并继续** → **返回到信息中心**

#### d) 创建 OAuth 客户端 ID
1. 左侧菜单: **API 和服务** → **凭据**
2. 点击 **创建凭据** → **OAuth 客户端 ID**
3. 应用类型: **Web 应用**
4. 名称: `DESCU Web Client`
5. **授权的重定向 URI**: 添加
   ```
   https://iubhtksmswvglcqxkoqi.supabase.co/auth/v1/callback
   ```
6. 点击 **创建**
7. **📋 复制 Client ID 和 Client Secret**

---

### 2️⃣ 在 Supabase 中启用 Google Provider

**访问**: https://supabase.com/dashboard/project/iubhtksmswvglcqxkoqi

1. 左侧菜单: **Authentication** → **Providers**
2. 找到 **Google** 并展开
3. 启用: **Enable Sign in with Google** ✅
4. 填入:
   - **Client ID**: 从 Google Cloud Console 复制
   - **Client Secret**: 从 Google Cloud Console 复制
5. 点击 **Save**

---

### 3️⃣ 在前端集成登录按钮

登录逻辑集中在 `src/features/auth/`：

```tsx
import { useAuth } from '@/features/auth';

const { user, login, logout, requireUser } = useAuth();

// 触发 Google 登录（Web 重定向 / 原生打开系统浏览器 + deep link 回调）
<button onClick={login}>Google Login</button>

// 需要登录才能执行的操作：未登录时自动弹出登录框
<button onClick={() => requireUser(u => startSelling(u))}>卖闲置</button>
```

---

## 🧪 测试登录功能

### 开发环境测试
1. 确保两个服务器都在运行：
   - 后端: `http://localhost:3000`
   - 前端: `http://localhost:5173`
2. 访问 `http://localhost:5173`
3. 点击 "使用 Google 登录" 按钮
4. 选择您的 Google 账户
5. 授权应用访问您的基本信息
6. 登录成功后会显示您的头像和名字

### 生产环境配置
当部署到生产环境时，需要：
1. 在 Google Cloud Console 的 OAuth 客户端中添加生产环境的重定向 URI：
   ```
   https://your-domain.com/auth/callback
   ```
2. 更新 Supabase 项目的 Site URL（在 Settings → API → Site URL）
3. 在 OAuth 同意屏幕中更新应用首页链接

---

## 🔒 安全注意事项

- ✅ Client Secret 仅在 Supabase Dashboard 中配置，不要暴露在前端代码
- ✅ Supabase 会自动处理 OAuth 流程和令牌管理
- ✅ 用户信息存储在 Supabase Auth 中，可以通过 `supabase.auth.getUser()` 获取
- ✅ 使用 Row Level Security (RLS) 保护用户数据

---

## 📚 相关文档

- [Google OAuth 2.0 设置](https://support.google.com/cloud/answer/6158849)
- [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)

---

## ✅ 下一步

配置完成后请告诉我，我会帮您：
1. 将 AuthButton 集成到 Navbar
2. 更新用户状态管理
3. 在商品上传时自动关联登录用户
