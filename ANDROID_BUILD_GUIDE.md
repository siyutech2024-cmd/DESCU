# Android签名APK/AAB构建指南

## 前置条件

✅ Android Studio已安装
✅ Java JDK 21已配置
✅ Capacitor项目已同步完成

---

## 第一步: 创建签名密钥

### 方法A: 使用Android Studio GUI

1. 打开 **Build** → **Generate Signed Bundle / APK**
2. 选择 **APK** 或 **Android App Bundle** (推荐AAB用于Google Play)
3. 点击 **Create new...** 创建新密钥库

**填写密钥信息**:
```
Key store path: /Users/ishak/descu-keystore.jks
Password: [设置强密码]
Alias: descu-key
Key password: [与keystore密码相同或不同]
Validity: 25 years
First and Last Name: [您的名字]
Organization: Venya Marketplace
Country: [您的国家代码，如MX]
```

### 方法B: 使用命令行

```bash
# 在项目根目录执行
keytool -genkey -v -keystore ~/descu-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias descu-key
```

**⚠️ 重要**: 妥善保存密钥文件和密码，它们是发布应用的唯一凭证！

---

## 第二步: 配置Gradle签名

### 创建密钥配置文件

在 `android/` 目录下创建 `keystore.properties`:

```properties
storeFile=/Users/ishak/descu-keystore.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=descu-key
keyPassword=YOUR_KEY_PASSWORD
```

**⚠️ 安全提示**: 将此文件添加到 `.gitignore`，不要提交到Git！

### 修改 build.gradle

编辑 `android/app/build.gradle`，在 `android {}` 块前添加:

```gradle
// 加载密钥配置
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... 现有配置 ...
    
    // 添加签名配置
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release  // 添加这行
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 第三步: 在Android Studio中构建

### 构建签名APK

1. **Build** → **Generate Signed Bundle / APK**
2. 选择 **APK**
3. 选择您的密钥库文件
4. 输入密码和别名
5. 选择 **release** build variant
6. 勾选 **V1 (Jar Signature)** 和 **V2 (Full APK Signature)**
7. 点击 **Finish**

**输出位置**: `android/app/release/app-release.apk`

### 构建App Bundle (推荐用于Google Play)

1. **Build** → **Generate Signed Bundle / APK**
2. 选择 **Android App Bundle**
3. 选择您的密钥库和release variant
4. 点击 **Finish**

**输出位置**: `android/app/release/app-release.aab`

---

## 第四步: 测试签名APK

### 安装到设备

```bash
# 使用adb安装
adb install android/app/release/app-release.apk

# 或在Android Studio中
# Run → Select 'app' → Run 'app'
```

### 验证签名

```bash
# 查看APK签名信息
keytool -printcert -jarfile android/app/release/app-release.apk
```

---

## 第五步: 准备Google Play发布

### 优化AAB大小

在 `android/app/build.gradle` 中启用代码压缩:

```gradle
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true  // 改为true
        shrinkResources true  // 添加
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 生成上传密钥 (可选但推荐)

Google Play支持使用上传密钥与签名密钥分离:

```bash
keytool -genkeypair -alias upload-key -keyalg RSA \
  -keysize 2048 -validity 10000 \
  -keystore ~/descu-upload-keystore.jks
```

### Google Play Console准备

1. 访问 [Google Play Console](https://play.google.com/console)
2. 创建新应用
3. 填写应用详情:
   - **应用名称**: Venya Marketplace
   - **包名**: com.venya.marketplace
   - **类别**: 购物
4. 上传AAB文件
5. 填写隐私政策、屏幕截图等

---

## 常见问题排查

### 问题1: 找不到密钥库

**解决**: 确保 `keystore.properties` 中的路径是绝对路径

### 问题2: 构建失败 - ProGuard错误

**解决**: 在 `proguard-rules.pro` 中添加:
```
-keep class com.venya.marketplace.** { *; }
-keep class io.ionic.** { *; }
```

### 问题3: APK安装失败

**解决**: 卸载之前的debug版本:
```bash
adb uninstall com.venya.marketplace
```

### 问题4: 签名验证失败

**解决**: 确保V1和V2签名都启用

---

## 快速命令参考

```bash
# 构建release APK (需要先配置签名)
cd android
./gradlew assembleRelease

# 构建release AAB
./gradlew bundleRelease

# 查看构建变体
./gradlew tasks --all | grep -i release

# 清理构建
./gradlew clean
```

---

## 版本号管理

在 `android/app/build.gradle` 中更新版本:

```gradle
defaultConfig {
    applicationId "com.venya.marketplace"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 1        // 每次发布递增
    versionName "1.0.0"  // 显示给用户的版本号
}
```

---

## 安全检查清单

- [ ] 密钥库文件已备份到安全位置
- [ ] keystore.properties 已添加到 .gitignore
- [ ] 密码已安全保存
- [ ] 已启用V1和V2签名
- [ ] 已测试签名APK在真机上运行
- [ ] 版本号已正确设置
- [ ] 已准备好Google Play所需的所有资源

---

**祝您发布顺利！** 🚀
