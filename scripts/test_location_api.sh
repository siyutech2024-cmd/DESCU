#!/bin/bash

echo "🔍 位置 API 诊断工具"
echo "===================="
echo ""

# 检查 1: 验证后端路由代码
echo "✓ 步骤 1: 检查后端路由代码"
if grep -q "^app.get('/api/location/reverse'" server/src/index.ts; then
    echo "  ✅ 路由已启用"
else
    echo "  ❌ 路由仍被注释 - 请检查 server/src/index.ts 第 190 行"
    exit 1
fi
echo ""

# 检查 2: 测试后端 API
echo "✓ 步骤 2: 测试后端 API"
echo "  测试坐标: 墨西哥城 (19.4326, -99.1332)"
RESPONSE=$(curl -s "http://localhost:3000/api/location/reverse?lat=19.4326&lon=-99.1332")

if echo "$RESPONSE" | grep -q "address"; then
    CITY=$(echo "$RESPONSE" | grep -o '"city":"[^"]*"' | cut -d'"' -f4)
    SUBURB=$(echo "$RESPONSE" | grep -o '"suburb":"[^"]*"' | cut -d'"' -f4)
    echo "  ✅ API 正常工作"
    echo "     城市: $CITY"
    echo "     区域: $SUBURB"
else
    echo "  ❌ API 返回错误:"
    echo "$RESPONSE" | head -n 5
    echo ""
    echo "  💡 可能原因:"
    echo "     - 后端服务器未运行 (运行 'npm run dev')"
    echo "     - 后端服务器未重启 (需要 Ctrl+C 然后重新运行)"
    exit 1
fi
echo ""

# 检查 3: 验证前端构建
echo "✓ 步骤 3: 检查前端构建"
if [ -f "dist/index.html" ]; then
    BUILD_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" dist/index.html)
    echo "  ℹ️  最后构建时间: $BUILD_TIME"
    echo "  💡 如果时间很旧，运行 'npm run build'"
else
    echo "  ⚠️  未找到构建文件 - 运行 'npm run build'"
fi
echo ""

echo "===================="
echo "✅ 诊断完成"
echo ""
echo "📝 下一步:"
echo "1. 确保后端服务器正在运行 (npm run dev)"
echo "2. 清除浏览器缓存 (Ctrl+Shift+R)"
echo "3. 重新测试发布产品"
