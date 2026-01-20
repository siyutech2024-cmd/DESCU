/**
 * 生成Android和iOS应用图标脚本
 * 运行: node scripts/generate-app-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 源图标路径 (使用生成的Android图标)
const SOURCE_ICON = path.join(__dirname, '../.gemini-source-icon.png');

// Android mipmap 尺寸配置
const ANDROID_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
};

// Android foreground 尺寸 (108dp * density)
const ANDROID_FOREGROUND_SIZES = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
};

// iOS 尺寸配置
const IOS_SIZE = 1024;

const ANDROID_RES_PATH = path.join(__dirname, '../android/app/src/main/res');
const IOS_ASSETS_PATH = path.join(__dirname, '../ios/App/App/Assets.xcassets/AppIcon.appiconset');

async function generateIcons() {
    console.log('🎨 开始生成应用图标...\n');

    // 检查源文件是否存在
    if (!fs.existsSync(SOURCE_ICON)) {
        console.error('❌ 源图标文件不存在:', SOURCE_ICON);
        console.log('请先将源图标复制到项目根目录');
        process.exit(1);
    }

    // 生成 Android 图标
    console.log('📱 生成 Android 图标...');
    for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
        const outputDir = path.join(ANDROID_RES_PATH, folder);

        // ic_launcher.png
        await sharp(SOURCE_ICON)
            .resize(size, size)
            .png()
            .toFile(path.join(outputDir, 'ic_launcher.png'));
        console.log(`  ✓ ${folder}/ic_launcher.png (${size}x${size})`);

        // ic_launcher_round.png
        await sharp(SOURCE_ICON)
            .resize(size, size)
            .png()
            .toFile(path.join(outputDir, 'ic_launcher_round.png'));
        console.log(`  ✓ ${folder}/ic_launcher_round.png (${size}x${size})`);
    }

    // 生成 Android foreground 图标
    console.log('\n📱 生成 Android Foreground 图标...');
    for (const [folder, size] of Object.entries(ANDROID_FOREGROUND_SIZES)) {
        const outputDir = path.join(ANDROID_RES_PATH, folder);

        // 创建带透明边距的 foreground 图标 (图标居中，周围有padding)
        const iconSize = Math.round(size * 0.65); // 图标占65%
        const padding = Math.round((size - iconSize) / 2);

        await sharp(SOURCE_ICON)
            .resize(iconSize, iconSize)
            .extend({
                top: padding,
                bottom: padding,
                left: padding,
                right: padding,
                background: { r: 233, g: 30, b: 99, alpha: 1 } // 粉红色背景 #E91E63
            })
            .resize(size, size)
            .png()
            .toFile(path.join(outputDir, 'ic_launcher_foreground.png'));
        console.log(`  ✓ ${folder}/ic_launcher_foreground.png (${size}x${size})`);
    }

    // 生成 iOS 图标
    console.log('\n🍎 生成 iOS 图标...');
    await sharp(SOURCE_ICON)
        .resize(IOS_SIZE, IOS_SIZE)
        .png()
        .toFile(path.join(IOS_ASSETS_PATH, 'AppIcon-512@2x.png'));
    console.log(`  ✓ AppIcon-512@2x.png (${IOS_SIZE}x${IOS_SIZE})`);

    console.log('\n✅ 所有图标生成完成！');
}

generateIcons().catch(err => {
    console.error('❌ 生成图标时出错:', err);
    process.exit(1);
});
