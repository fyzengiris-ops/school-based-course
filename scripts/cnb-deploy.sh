#!/usr/bin/env bash
# CloudBase / CNB 自定义部署入口：先产出 dist，再托管上传。
# 控制台「自定义部署命令」请改成：
#   bash scripts/cnb-deploy.sh
# 或：
#   npm run build && tcb hosting deploy ./dist /school-based-course -e ocr-d9g7saru92fdcecb4
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_ID="${CLOUDBASE_ENV_ID:-ocr-d9g7saru92fdcecb4}"
CLOUD_PATH="${CLOUDBASE_CLOUD_PATH:-/school-based-course}"

echo "[cnb-deploy] building static site -> dist/"
node scripts/build-static.js

if [ ! -f dist/index.html ]; then
  echo "[cnb-deploy] ERROR: dist/index.html missing after build"
  exit 1
fi

echo "[cnb-deploy] deploying ./dist ${CLOUD_PATH} -e ${ENV_ID}"
tcb hosting deploy ./dist "${CLOUD_PATH}" -e "${ENV_ID}"
echo "[cnb-deploy] done"
