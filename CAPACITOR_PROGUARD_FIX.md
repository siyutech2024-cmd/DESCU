# Capacitor ProGuard 修复说明

## 问题描述

在Android Studio构建时遇到以下错误：
```
`getDefaultProguardFile('proguard-android.txt')` is no longer supported
```

## 原因

Capacitor 8.x的某些插件（@capacitor/camera和@capacitor/geolocation）仍在使用已弃用的ProGuard配置文件。新版本的Android Gradle要求使用优化版本。

## 解决方案

### 已应用的修复

✅ 已修复以下插件的build.gradle文件：
- `node_modules/@capacitor/camera/android/build.gradle`
- `node_modules/@capacitor/geolocation/android/build.gradle`

将以下行：
```gradle
proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
```

替换为：
```gradle
proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
```

### 自动修复脚本

已创建 `scripts/fix-capacitor-proguard.sh` 脚本，并在 `package.json` 中配置了 `postinstall` 钩子。

这意味着每次运行 `npm install` 后，修复会自动应用。

### 手动应用修复（如果需要）

```bash
bash scripts/fix-capacitor-proguard.sh
```

## 验证

修复后，重新同步Android项目：
```bash
npm run android:sync
```

然后在Android Studio中重新构建项目，错误应该已解决。

## 注意事项

⚠️ 此修复修改了 `node_modules` 中的文件。虽然我们添加了 postinstall 脚本来自动重新应用修复，但最佳实践是等待 Capacitor 官方更新这些插件。

## 相关链接

- [Android ProGuard Files Documentation](https://developer.android.com/studio/build/shrink-code#configuration-files)
- [Capacitor Android Plugin Guide](https://capacitorjs.com/docs/android/custom-code)
