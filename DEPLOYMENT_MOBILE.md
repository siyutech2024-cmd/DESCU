# 移动端部署指南 (Android & iOS)

本指南介绍了如何使用 Capacitor 将 "Venya Marketplace" Web 应用程序部署到 Android 和 iOS 平台。

## 前置条件 (Prerequisites)

1.  **Node.js**: 确保已安装 Node.js。
2.  **Android Studio**: Android 部署必需。
    - 安装 Android SDK Command-line Tools。
    - 创建一个 Android 虚拟设备 (AVD) 或在物理设备上启用 USB 调试。
3.  **Xcode**: iOS 部署必需 (仅限 macOS)。
    - 安装 CocoaPods (`sudo gem install cocoapods`)。

## 快速开始 (Quick Start)

1.  **安装依赖** (如果尚未安装):
    ```bash
    npm install
    # 如果缺少 Capacitor 依赖，请安装
    npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
    ```

2.  **同步到原生项目**:
    使用由于脚本构建 Web 应用并将其同步到 `android` 和 `ios` 文件夹：
    ```bash
    npm run mobile:build
    ```

## Android 部署

1.  **打开 Android Studio**:
    ```bash
    npm run mobile:open:android
    ```
2.  **运行应用**:
    - 在 Android Studio 中，等待 Gradle 同步完成。
    - 在顶部工具栏选择你的模拟器或已连接的设备。
    - 点击绿色的 **Run** (运行) 按钮。

### Android 常见问题排查
- **API 连接错误**: 移动应用无法直接访问电脑的 `localhost`。请使用公网 URL (例如 Vercel 部署的地址) 或你电脑的局域网 IP (例如 `http://192.168.1.5:3000`)。请在 `.env` 或 `.env.local` 中更新 `VITE_API_URL` 并重新构建。
- **明文流量 (Clear Text Traffic)**: 如果使用 HTTP (非 HTTPS)，你可能需要在 `android/app/src/main/AndroidManifest.xml` 中允许明文流量 (生产环境不推荐)。

## iOS 部署

1.  **打开 Xcode**:
    ```bash
    npm run mobile:open:ios
    ```
2.  **运行应用**:
    - 选择目标模拟器或设备 (例如 "iPhone 15")。
    - 点击 **Run** (类似播放图标) 按钮。

### iOS 常见问题排查
- **签名团队 (Signing Team)**: 你需要一个 Apple ID。在左侧边栏点击 "App" 项目，选择 "App" target，进入 "Signing & Capabilities"，然后选择一个 "Team"。
- **CocoaPods**: 如果遇到 pod 相关问题，尝试运行 `cd ios/App && pod install`。

## 关于 API 配置的重要说明

移动应用运行在 `capacitor://localhost` (或类似环境) 上。它 **不能** 直接访问你电脑上的 `http://localhost:3000`。

**解决方案**:
1.  部署你的后端 (例如部署到 Vercel, Railway)。
2.  在 `.env.production` (或用于本地测试的 `.env`) 中将 `VITE_API_URL` 设置为公网后端 URL。
    ```
    VITE_API_URL=https://your-backend-url.vercel.app
    ```
3.  重新运行 `npm run mobile:build`。
