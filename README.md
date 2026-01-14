
# VENYA - 墨西哥二手交易平台 (Mexico Marketplace)

这是一个基于 React + Vite + Tailwind CSS 开发的现代二手交易 Web 应用。

## 📦 如何生成本地静态文件包 (Build)

如果您想生成可以在服务器部署或本地预览的静态文件（HTML/CSS/JS），请按照以下步骤操作：

### 1. 安装依赖
打开终端（Terminal），在项目根目录下运行：
```bash
npm install
```

### 2. 配置 API Key
确保您在根目录下创建了 `.env` 文件（或设置环境变量），填入您的 Gemini API Key：
```env
API_KEY=your_google_gemini_api_key_here
```

### 3. 构建项目
运行构建命令：
```bash
npm run build
```
成功后，您会在项目根目录下看到一个 `dist` 文件夹。
*   `dist` 文件夹就是您需要的**静态文件包**。
*   里面包含 `index.html` 和 `assets` 文件夹。

### 4. 本地预览 (Preview)
由于浏览器安全策略限制，直接双击打开 `dist/index.html` 可能会导致某些功能（如图片加载、API请求）受限。推荐使用以下命令预览：

```bash
npm run preview
```
或者使用简单的静态服务器：
```bash
npx serve dist
```

## ☁️ 部署后端 & 上线 (Google Cloud / Firebase)

本项目已经配置好 **Firebase** 支持（Google Cloud 的 Serverless 平台）。这包含托管前端、数据库和身份验证。

### 步骤 1: 创建 Firebase 项目
1. 访问 [Firebase Console](https://console.firebase.google.com/)。
2. 点击 "Add project" (新建项目)。
3. 输入项目名称 (例如 `venya-app`) 并创建。

### 步骤 2: 获取配置
1. 在项目概览页面，点击 Web 图标 (`</>`) 添加应用。
2. 注册应用后，您会看到 `firebaseConfig`。
3. 在本地项目根目录创建 `.env.local` 文件，并填入以下内容：

```env
API_KEY=your_gemini_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 步骤 3: 开启服务 (在 Firebase Console 中)
1. **Authentication (身份验证)**:
   - 进入 Authentication -> Sign-in method。
   - 开启 **Google** 和 **Email/Password** 登录。
2. **Firestore Database (数据库)**:
   - 进入 Firestore Database -> Create database。
   - 选择 Start in **production mode**。
3. **Storage (存储)**:
   - 进入 Storage -> Get started。
   - 同样开启生产模式。

### 步骤 4: 一键部署 (Deploy)

确保您已安装 Firebase CLI:
```bash
npm install -g firebase-tools
```

在项目根目录运行：

1. **登录**:
   ```bash
   firebase login
   ```
2. **初始化**:
   ```bash
   firebase init
   ```
   - 选择: `Hosting: Configure files for Firebase Hosting...`
   - Use an existing project -> 选择刚才创建的项目。
   - What do you want to use as your public directory? -> 输入 `dist`
   - Configure as a single-page app? -> 输入 `y` (Yes)
   - Set up automatic builds and deploys with GitHub? -> `n` (No)

3. **构建并部署**:
   ```bash
   npm run build
   firebase deploy
   ```

完成后，终端会显示 `Hosting URL`，这不仅是您的前端网址，也是已连接好 Google Cloud 后端的完整应用！

## 🛠️ 开发模式 (Development)

如果您想在本地进行代码开发和调试：
```bash
npm run dev
```

## ✨ 技术栈

*   **Frontend**: React 18, TypeScript
*   **Styling**: Tailwind CSS
*   **Build Tool**: Vite
*   **AI Integration**: Google Gemini 2.5 Flash
*   **Backend (Optional)**: Firebase (Auth, Firestore, Storage)
*   **Icons**: Lucide React
