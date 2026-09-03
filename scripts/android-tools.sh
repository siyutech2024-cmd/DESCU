#!/bin/bash
# Android构建辅助工具脚本

PROJECT_ROOT="/Users/ishak/Downloads/descu---二手智选"
ANDROID_DIR="$PROJECT_ROOT/android"

# 显示帮助信息
show_help() {
    cat << EOF
🤖 DESCU Android 构建工具

用法: ./android-tools.sh [命令]

命令:
  sync        - 同步Capacitor项目到Android
  build       - 构建生产版本APK
  debug       - 构建调试版本APK
  open        - 在Android Studio中打开项目
  clean       - 清理构建缓存
  run         - 安装并运行到连接的设备
  help        - 显示此帮助信息

示例:
  ./android-tools.sh sync
  ./android-tools.sh build

EOF
}

# 同步Capacitor项目
sync_project() {
    echo "📦 同步Capacitor项目到Android..."
    cd "$PROJECT_ROOT"
    npm run android:sync
}

# 构建release APK
build_release() {
    echo "🔨 构建生产版本APK..."
    cd "$PROJECT_ROOT"
    npm run build
    npx cap sync android
    cd "$ANDROID_DIR"
    ./gradlew assembleRelease
    echo "✅ APK已生成: $ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
}

# 构建debug APK
build_debug() {
    echo "🔨 构建调试版本APK..."
    cd "$ANDROID_DIR"
    ./gradlew assembleDebug
    echo "✅ APK已生成: $ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
}

# 在Android Studio中打开
open_studio() {
    echo "🚀 在Android Studio中打开项目..."
    cd "$PROJECT_ROOT"
    npm run android:open
}

# 清理构建缓存
clean_build() {
    echo "🧹 清理构建缓存..."
    cd "$ANDROID_DIR"
    ./gradlew clean
    echo "✅ 清理完成"
}

# 安装并运行
run_app() {
    echo "📱 安装并运行应用..."
    cd "$ANDROID_DIR"
    ./gradlew installDebug
    adb shell am start -n com.venya.marketplace/.MainActivity
}

# 主程序
case "${1:-help}" in
    sync)
        sync_project
        ;;
    build)
        build_release
        ;;
    debug)
        build_debug
        ;;
    open)
        open_studio
        ;;
    clean)
        clean_build
        ;;
    run)
        run_app
        ;;
    help|*)
        show_help
        ;;
esac
