#!/bin/bash
# Post-install fix: Capacitor 8 Android packages still reference
# getDefaultProguardFile('proguard-android.txt'), which AGP 9 rejects
# ("no longer supported since it includes -dontoptimize").
# Rewrites every Capacitor Android build.gradle under node_modules to the
# supported 'proguard-android-optimize.txt'. Idempotent; safe to re-run.
set -u
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

fixed=0
for f in node_modules/@capacitor/android/capacitor/build.gradle node_modules/@capacitor/*/android/build.gradle; do
  [ -f "$f" ] || continue
  if grep -q "proguard-android\.txt" "$f"; then
    # portable in-place edit (GNU sed and BSD/macOS sed differ on -i)
    tmp="$f.tmp.$$"
    sed "s/proguard-android\.txt/proguard-android-optimize.txt/g" "$f" > "$tmp" && mv "$tmp" "$f"
    echo "  fixed $f"
    fixed=$((fixed + 1))
  fi
done
echo "ProGuard fix: $fixed file(s) patched"
