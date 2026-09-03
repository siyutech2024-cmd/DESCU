import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Android icon sizes
const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
};

const svgPath = path.join(__dirname, 'public', 'logo-descu.svg');
const androidResPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

async function generateIcons() {
    console.log('🎨 Generating Android app icons from logo-descu.svg...\n');

    // Read SVG file
    const svgBuffer = fs.readFileSync(svgPath);

    for (const [folder, size] of Object.entries(sizes)) {
        const outputPath = path.join(androidResPath, folder, 'ic_launcher.png');
        const outputDir = path.dirname(outputPath);

        // Ensure directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        try {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(outputPath);

            console.log(`✅ Generated ${folder}/ic_launcher.png (${size}x${size})`);
        } catch (error) {
            console.error(`❌ Failed to generate ${folder}/ic_launcher.png:`, error.message);
        }
    }

    // Also generate round icon
    for (const [folder, size] of Object.entries(sizes)) {
        const outputPath = path.join(androidResPath, folder, 'ic_launcher_round.png');
        const outputDir = path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        try {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(outputPath);

            console.log(`✅ Generated ${folder}/ic_launcher_round.png (${size}x${size})`);
        } catch (error) {
            console.error(`❌ Failed to generate ${folder}/ic_launcher_round.png:`, error.message);
        }
    }

    console.log('\n🎉 All Android icons generated successfully!');
    console.log('📱 Next step: Run "npx cap sync" to update the app');
}

generateIcons().catch(console.error);
