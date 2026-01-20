# Android应用问题修复指南

## 🎯 问题总结

您报告的三个问题及其解决方案：

1. ✅ **应用名称** - 已修复为"DESCU"
2. ⚠️ **主页没有产品显示** - 需要配置API URL
3. ⚠️ **Google登录无法返回** - 需要配置OAuth redirect URI

---

## 问题1: 应用名称 ✅ 已修复

### 已完成的修改

**修改文件1**: `capacitor.config.ts`
```typescript
appName: 'DESCU'  // 原来是 'Venya Marketplace'
```

**修改文件2**: `android/app/src/main/res/values/strings.xml`
```xml
<string name="app_name">DESCU</string>
```

### 重新构建应用

```bash
cd /Users/ishak/Downloads/descu---二手智选
npm run android:build
```

---

## 问题2: 主页没有产品显示 ⚠️ 需要配置

### 原因分析

应用无法加载产品是因为没有配置后端API URL。当前`API_BASE_URL`为空字符串，导致API请求失败。

### 解决方案

#### 步骤1: 确认您的后端URL

您的后端应该已经部署在某个地方（如Vercel、Railway等）。假设您的后端URL是：
```
https://descu-backend.vercel.app
```

#### 步骤2: 创建生产环境变量文件

在项目根目录创建 `.env.production` 文件：

```bash
cd /Users/ishak/Downloads/descu---二手智选
cat > .env.production << 'EOF'
# 后端API URL（重要！）
VITE_API_URL=https://your-backend-url.vercel.app

# Supabase配置
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Stripe配置
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
EOF
```

#### 步骤3: 替换实际值

编辑 `.env.production` 文件，替换以下值：

1. **VITE_API_URL**: 您的后端URL（查看Vercel部署URL）
2. **VITE_SUPABASE_URL**: 从Supabase项目设置中获取
3. **VITE_SUPABASE_ANON_KEY**: 从Supabase项目设置中获取
4. **VITE_STRIPE_PUBLISHABLE_KEY**: 从Stripe Dashboard获取

#### 步骤4: 重新构建

```bash
npm run android:build
```

---

## 问题3: Google登录无法返回APP ⚠️ 需要配置

### 原因分析

Google OAuth登录后需要重定向回应用，但Supabase没有配置正确的redirect URI。

### 解决方案

#### 步骤1: 获取Deep Link URI

您的应用Deep Link URI是：
```
com.venya.marketplace://
```

#### 步骤2: 在Supabase中配置

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 **Authentication** → **URL Configuration**
4. 在 **Redirect URLs** 中添加：
   ```
   com.venya.marketplace://
   com.venya.marketplace://google-callback
   ```

5. 点击 **Save**

#### 步骤3: 测试Google登录

1. 在应用中点击"Entrar"（登录）
2. 选择Google登录
3. 授权后应该能正确返回应用

---

## 完整的重新构建流程

### 1. 配置环境变量

```bash
cd /Users/ishak/Downloads/descu---二手智选

# 创建 .env.production 文件
nano .env.production
```

粘贴并修改：
```env
VITE_API_URL=https://你的后端URL.vercel.app
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=你的Supabase Anon Key
VITE_STRIPE_PUBLISHABLE_KEY=你的Stripe Public Key
```

### 2. 同步配置到Android

```bash
npx cap sync android
```

### 3. 重新构建APK

**方法1: 使用脚本（推荐）**
```bash
npm run android:build
```

**方法2: 在Android Studio中**
1. Build → Clean Project
2. Build → Rebuild Project
3. Build → Generate Signed Bundle / APK
4. 选择密钥，构建release版本

### 4. 安装新APK

```bash
# 卸载旧版本
adb uninstall com.venya.marketplace

# 安装新版本
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## 验证修复

安装新APK后，验证以下功能：

### ✅ 应用名称
- 在应用列表中显示"DESCU"
- 应用顶部显示"DESCU"

### ✅ 产品显示
- 打开应用后，主页应该显示产品列表
- 不应该显示"¡Sé el primero en vender algo!"

### ✅ Google登录
1. 点击"Entrar"
2. 选择Google账号
3. 授权后应该返回应用
4. 应该能看到用户头像

---

## 调试技巧

### 查看API请求

在Chrome中使用Remote Debugging：

1. 连接手机到电脑
2. Chrome打开 `chrome://inspect`
3. 点击您的设备下的"inspect"
4. 打开Console标签
5. 重新加载应用，查看API请求

### 查看Logcat

在Android Studio中：
1. 底部点击"Logcat"
2. 过滤包名：`com.venya.marketplace`
3. 查找错误信息

### 常见问题

**问题**: 仍然没有产品
- 检查 `.env.production` 文件是否正确
- 确认后端URL可访问
- 检查后端是否有产品数据

**问题**: 登录后立即闪退
- 检查Supabase Redirect URLs配置
- 确认Deep Link配置正确

**问题**: API请求CORS错误
- 后端需要允许移动端域名
- 或使用`androidScheme: 'https'`（已配置）

---

## 需要的信息清单

请提供以下信息以完成配置：

- [ ] 后端API URL（Vercel部署URL）
- [ ] Supabase项目URL
- [ ] Supabase Anon Key
- [ ] Stripe Publishable Key

提供这些信息后，我可以帮您直接创建 `.env.production` 文件。

---

**如有任何问题，请随时告诉我！**
