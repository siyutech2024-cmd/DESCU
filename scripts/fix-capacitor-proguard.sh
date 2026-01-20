#!/bin/bash
# Post-install script to fix Capacitor plugins ProGuard configuration

echo "🔧 Fixing Capacitor plugins ProGuard configuration..."

# Fix @capacitor/camera
CAMERA_GRADLE="node_modules/@capacitor/camera/android/build.gradle"
if [ -f "$CAMERA_GRADLE" ]; then
    sed -i.bak "s/proguard-android\.txt/proguard-android-optimize.txt/g" "$CAMERA_GRADLE"
    echo "✓ Fixed @capacitor/camera"
fi

# Fix @capacitor/geolocation
GEO_GRADLE="node_modules/@capacitor/geolocation/android/build.gradle"
if [ -f "$GEO_GRADLE" ]; then
    sed -i.bak "s/proguard-android\.txt/proguard-android-optimize.txt/g" "$GEO_GRADLE"
    echo "✓ Fixed @capacitor/geolocation"
fi

echo "✅ ProGuard configuration fixes applied!"
