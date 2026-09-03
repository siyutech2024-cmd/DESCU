#!/bin/bash
# APK签名自动化脚本

set -e

PROJECT_ROOT="/Users/ishak/Downloads/descu---二手智选"
KEYSTORE_FILE="$PROJECT_ROOT/descu-release.jks"
KEYSTORE_PROPS="$PROJECT_ROOT/android/keystore.properties"

echo "🔐 DESCU APK 签名工具"
echo "===================="
echo ""

# 检查密钥库是否已存在
if [ -f "$KEYSTORE_FILE" ]; then
    echo "✓ 发现现有密钥库: $KEYSTORE_FILE"
    echo ""
    read -p "是否使用现有密钥库? (y/n): " use_existing
    if [ "$use_existing" != "y" ]; then
        echo "操作已取消"
        exit 0
    fi
else
    echo "⚠️  未找到密钥库，需要创建新的密钥库"
    echo ""
    
    # 获取密码
    read -sp "请输入密钥库密码（建议：descu2024）: " KEYSTORE_PASSWORD
    echo ""
    read -sp "请再次输入密码: " KEYSTORE_PASSWORD2
    echo ""
    
    if [ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD2" ]; then
        echo "❌ 密码不匹配！"
        exit 1
    fi
    
    # 获取基本信息
    read -p "您的姓名 [DESCU Dev]: " CN
    CN=${CN:-DESCU Dev}
    
    read -p "组织单位 [Development]: " OU
    OU=${OU:-Development}
    
    read -p "组织名称 [DESCU]: " O
    O=${O:-DESCU}
    
    read -p "城市 [Ciudad de Mexico]: " L
    L=${L:-Ciudad de Mexico}
    
    read -p "省份/州 [CDMX]: " ST
    ST=${ST:-CDMX}
    
    read -p "国家代码 [MX]: " C
    C=${C:-MX}
    
    echo ""
    echo "📝 创建密钥库..."
    
    # 创建密钥库
    keytool -genkey -v -keystore "$KEYSTORE_FILE" \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -alias descu-key \
        -dname "CN=$CN, OU=$OU, O=$O, L=$L, ST=$ST, C=$C" \
        -storepass "$KEYSTORE_PASSWORD" \
        -keypass "$KEYSTORE_PASSWORD"
    
    echo "✅ 密钥库创建成功！"
    echo ""
    
    # 创建keystore.properties
    cat > "$KEYSTORE_PROPS" << EOF
storeFile=$KEYSTORE_FILE
storePassword=$KEYSTORE_PASSWORD
keyAlias=descu-key
keyPassword=$KEYSTORE_PASSWORD
EOF
    
    echo "✅ 配置文件已创建: $KEYSTORE_PROPS"
fi

echo ""
echo "🔨 开始构建签名APK..."
echo ""

# 设置Java环境
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

# 构建APK
cd "$PROJECT_ROOT/android"
./gradlew clean
./gradlew assembleRelease

echo ""
echo "✅ 构建完成！"
echo ""

# 查找APK
APK_PATH="$PROJECT_ROOT/android/app/build/outputs/apk/release"
if [ -f "$APK_PATH/app-release.apk" ]; then
    APK_FILE="$APK_PATH/app-release.apk"
    echo "📦 签名APK位置: $APK_FILE"
    
    # 验证签名
    echo ""
    echo "🔍 验证APK签名..."
    apksigner verify "$APK_FILE" && echo "✅ APK签名有效！" || echo "❌ APK签名验证失败"
    
    # 显示APK信息
    echo ""
    echo "📊 APK信息:"
    ls -lh "$APK_FILE"
    
    echo ""
    echo "🎉 成功！您现在可以安装此APK了"
    echo ""
    echo "安装命令:"
    echo "  adb install $APK_FILE"
    
elif [ -f "$APK_PATH/app-release-unsigned.apk" ]; then
    echo "⚠️  生成的仍是未签名APK"
    echo ""
    echo "请按照以下步骤配置Gradle签名："
    echo "1. 编辑 android/app/build.gradle"
    echo "2. 添加签名配置（参考 APK_SIGNING_GUIDE.md）"
    echo "3. 重新运行此脚本"
else
    echo "❌ 未找到APK文件"
    echo "请检查构建日志以了解错误"
fi
