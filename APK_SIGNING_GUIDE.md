# APK签名快速指南

## 问题说明

`app-release-unsigned.apk` 是未签名的APK，Android系统出于安全考虑不允许安装未签名的应用。

## 解决方案：创建签名APK

### 步骤1: 创建密钥库（Keystore）

```bash
cd /Users/ishak/Downloads/descu---二手智选

# 创建密钥库
keytool -genkey -v -keystore descu-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias descu-key
```

**您需要回答的问题**：
```
Enter keystore password: [输入密码，例如: descu2024]
Re-enter new password: [再次输入相同密码]
What is your first and last name? [您的姓名]
What is the name of your organizational unit? [Development]
What is the name of your organization? [DESCU]
What is the name of your City or Locality? [您的城市]
What is the name of your State or Province? [您的省份]
What is the two-letter country code for this unit? [MX 或您的国家代码]
Is CN=..., OU=..., O=..., L=..., ST=..., C=... correct? [yes]

Enter key password for <descu-key>: [按Enter使用相同密码]
```

⚠️ **重要**：请记住您的密码并妥善保存 `descu-release.jks` 文件！

### 步骤2: 配置Gradle签名

创建 `android/keystore.properties` 文件：

```bash
cat > android/keystore.properties << 'EOF'
storeFile=../descu-release.jks
storePassword=YOUR_PASSWORD_HERE
keyAlias=descu-key
keyPassword=YOUR_PASSWORD_HERE
EOF
```

**替换YOUR_PASSWORD_HERE为您刚才设置的密码**

### 步骤3: 更新build.gradle

编辑 `android/app/build.gradle`，在 `android {}` 块中添加签名配置。

### 步骤4: 重新构建签名APK

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

cd android
./gradlew clean
./gradlew assembleRelease
```

输出：`android/app/build/outputs/apk/release/app-release.apk` (已签名)

---

## 快捷方法：使用命令行签名工具

如果您想快速签名现有的unsigned APK：

```bash
# 1. 对齐APK
zipalign -v -p 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  android/app/build/outputs/apk/release/app-release-aligned.apk

# 2. 签名
apksigner sign --ks descu-release.jks \
  --out android/app/build/outputs/apk/release/app-release-signed.apk \
  android/app/build/outputs/apk/release/app-release-aligned.apk

# 3. 验证签名
apksigner verify android/app/build/outputs/apk/release/app-release-signed.apk
```

---

## 我来帮您自动完成

如果您想让我帮您自动创建和配置，请提供：
1. 密钥库密码（建议使用强密码）
2. 您的名字
3. 组织名称（可以用DESCU）

我会自动创建密钥库和配置文件，然后构建签名的APK。
