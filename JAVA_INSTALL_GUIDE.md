# Java环境安装指南（Mac）

## 问题诊断

您的系统缺少Java Runtime Environment (JRE)，这是Android Studio和Gradle构建所必需的。

## 🚀 快速解决方案

### 方法1：使用Homebrew安装（推荐）

```bash
# 1. 安装Java 21 (Android Gradle需要)
brew install openjdk@21

# 2. 创建符号链接
sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk

# 3. 设置环境变量
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
echo 'export JAVA_HOME="/opt/homebrew/opt/openjdk@21"' >> ~/.zshrc

# 4. 重新加载配置
source ~/.zshrc

# 5. 验证安装
java -version
```

### 方法2：从Oracle下载安装包

1. 访问 [Oracle JDK 21下载页面](https://www.oracle.com/java/technologies/downloads/#java21)
2. 选择 **macOS** → **Arm 64 DMG Installer** (如果是M系列芯片)
3. 或选择 **x64 DMG Installer** (如果是Intel芯片)
4. 下载并安装DMG包
5. 安装完成后，重启终端

### 方法3：使用Android Studio的内置JDK

Android Studio已经包含了JDK，我们可以配置使用它：

```bash
# 找到Android Studio的JDK路径
ls -la /Applications/Android\ Studio.app/Contents/jbr

# 设置环境变量（添加到 ~/.zshrc）
echo 'export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc

# 重新加载
source ~/.zshrc

# 验证
java -version
```

---

## ✅ 验证Java安装

安装完成后，运行以下命令验证：

```bash
java -version
javac -version
echo $JAVA_HOME
```

应该看到类似输出：
```
openjdk version "21.0.1"
OpenJDK Runtime Environment (build 21.0.1+12)
OpenJDK 64-Bit Server VM (build 21.0.1+12, mixed mode)
```

---

## 🔧 配置Gradle使用Java

在项目中创建 `gradle.properties`（如果还没有）：

```bash
cd /Users/ishak/Downloads/descu---二手智选/android
nano gradle.properties
```

添加：
```properties
org.gradle.java.home=/opt/homebrew/opt/openjdk@21
# 或使用Android Studio的JDK
# org.gradle.java.home=/Applications/Android Studio.app/Contents/jbr/Contents/Home
```

---

## 🎯 继续Android构建

Java安装完成后，您可以：

### 在Android Studio中构建
```bash
npm run android:open
```

### 使用命令行构建
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

---

## 💡 推荐：使用方法3（最快）

如果Android Studio已经安装，使用方法3最快：

```bash
# 一键配置
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

# 验证
java -version

# 如果成功，永久保存到配置文件
echo 'export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc
```

---

## 🐛 常见问题

**Q: homebrew找不到命令？**
```bash
# 安装Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Q: 权限被拒绝？**
```bash
# 使用sudo
sudo brew install openjdk@21
```

**Q: M1/M2 Mac的路径不同？**
- Intel Mac: `/usr/local/opt/openjdk@21`
- Apple Silicon (M1/M2): `/opt/homebrew/opt/openjdk@21`

---

现在请选择一个方法安装Java，然后我们继续构建APK！
