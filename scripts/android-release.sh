#!/bin/bash
# =============================================================================
# DESCU — build a signed Android App Bundle (AAB) for Google Play.
#
#   ./scripts/android-release.sh            # build web → cap sync → bundleRelease
#   ./scripts/android-release.sh --skip-web # reuse dist/ (already built & synced)
#
# Requirements on this machine (Android Studio provides all of them):
#   - JDK 17+  (AGP 9 / Gradle 9)          → JAVA_HOME or `java` on PATH
#   - Android SDK (compileSdk 36)          → ANDROID_HOME / ANDROID_SDK_ROOT or android/local.properties
#   - android/keystore.properties + the .jks it points to (never committed)
# Output: android/app/build/outputs/bundle/release/app-release.aab
# =============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
SKIP_WEB=0
[ "${1:-}" = "--skip-web" ] && SKIP_WEB=1

step() { printf '\n\033[1;35m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$1"; exit 1; }

step "Checking toolchain"
# Prefer Android Studio's bundled JDK when no JAVA_HOME is set (macOS).
if [ -z "${JAVA_HOME:-}" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/}java"
command -v "$JAVA_BIN" >/dev/null 2>&1 || fail "java not found — install Android Studio or a JDK 17+"
JAVA_MAJOR="$("$JAVA_BIN" -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+)(\.[0-9]+)*.*/\1/')"
[ "$JAVA_MAJOR" -ge 17 ] 2>/dev/null || fail "JDK 17+ required, found $JAVA_MAJOR (set JAVA_HOME)"
echo "  java $JAVA_MAJOR ($JAVA_BIN)"

if [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ] && [ ! -f "$ANDROID_DIR/local.properties" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  else
    fail "Android SDK not found — set ANDROID_HOME or create android/local.properties (sdk.dir=...)"
  fi
fi
echo "  sdk  ${ANDROID_HOME:-${ANDROID_SDK_ROOT:-android/local.properties}}"

[ -f "$ANDROID_DIR/keystore.properties" ] || fail "android/keystore.properties missing (copy keystore.properties.example and fill it in)"
STORE_FILE="$(grep '^storeFile=' "$ANDROID_DIR/keystore.properties" | cut -d= -f2-)"
# storeFile is resolved by Gradle relative to android/app
[ -f "$ANDROID_DIR/app/$STORE_FILE" ] || [ -f "$STORE_FILE" ] || fail "keystore '$STORE_FILE' not found (expected under android/app/)"
echo "  keystore $STORE_FILE"

VERSION_LINE="$(grep -E 'versionCode|versionName' "$ANDROID_DIR/app/build.gradle" | tr -s ' ' | tr '\n' ' ')"
echo "  $VERSION_LINE"

if [ "$SKIP_WEB" -eq 0 ]; then
  step "Installing dependencies"
  cd "$PROJECT_ROOT"
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

  step "Building web app (tsc + vite)"
  npm run build

  step "Syncing web assets into the Android project"
  npx cap sync android
fi

step "Patching Capacitor ProGuard config for AGP 9"
bash "$PROJECT_ROOT/scripts/fix-capacitor-proguard.sh"

step "Building signed release bundle (gradle bundleRelease)"
cd "$ANDROID_DIR"
./gradlew --no-daemon bundleRelease

[ -f "$AAB" ] || fail "bundle not produced at $AAB"

step "Verifying"
SIZE="$(du -h "$AAB" | cut -f1)"
echo "  AAB: $AAB ($SIZE)"
# Signer certificate (jarsigner ships with the JDK)
if command -v "${JAVA_HOME:+$JAVA_HOME/bin/}jarsigner" >/dev/null 2>&1; then
  "${JAVA_HOME:+$JAVA_HOME/bin/}jarsigner" -verify "$AAB" >/dev/null 2>&1 && echo "  signature: verified (jarsigner)" || echo "  signature: jarsigner could not verify — check keystore.properties"
fi
# Version inside the bundle (bundletool if available, else aapt2 on the manifest is not applicable to AAB)
if command -v bundletool >/dev/null 2>&1; then
  bundletool dump manifest --bundle "$AAB" | grep -oE 'android:versionCode="[0-9]+"|android:versionName="[^"]+"' | sed 's/^/  /'
fi

step "Done"
cat <<EOF
  Upload $AAB
  to Google Play Console → DESCU → Production (or Internal testing) → Create new release.
  Play uses the upload key in this keystore; the release notes can come from CHANGELOG / git log.
EOF
