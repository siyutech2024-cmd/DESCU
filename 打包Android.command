#!/bin/bash
# 双击运行：构建签名的 Android App Bundle（调用 scripts/android-release.sh）
cd "$(dirname "$0")"
LOG="./_to_delete_android-release.log"
echo "DESCU Android release build — $(date)" | tee "$LOG"
echo "工作目录: $(pwd)" | tee -a "$LOG"
echo | tee -a "$LOG"
ARGS=""
[ -d dist ] && [ -d android/app/src/main/assets/public ] && ARGS="--skip-web"
./scripts/android-release.sh $ARGS 2>&1 | tee -a "$LOG"
STATUS=${PIPESTATUS[0]}
echo | tee -a "$LOG"
if [ "$STATUS" -eq 0 ]; then
  echo "✅ 构建成功。日志: $LOG" | tee -a "$LOG"
  open -R "android/app/build/outputs/bundle/release/app-release.aab" 2>/dev/null || true
else
  echo "❌ 构建失败（退出码 $STATUS）。日志: $LOG" | tee -a "$LOG"
fi
echo "（可以关闭此窗口）"
