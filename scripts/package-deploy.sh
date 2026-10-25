#!/usr/bin/env bash
# Create a VPS deploy zip (run on Mac/Linux or Git Bash).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M)"
DIST="$ROOT/dist"
ZIP="$DIST/tms-deploy-$TIMESTAMP.zip"
STAGING="$(mktemp -d)"

mkdir -p "$DIST"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude out \
  --exclude build \
  --exclude .git \
  --exclude dist \
  --exclude .cursor \
  --exclude public/uploads \
  --exclude docker-compose.yml \
  --exclude .env \
  --exclude .env.production \
  --exclude '*.zip' \
  "$ROOT/" "$STAGING/"

(cd "$STAGING" && zip -rq "$ZIP" .)
rm -rf "$STAGING"

echo "Created: $ZIP"
echo "docker-compose.yml is NOT in the zip — use the file already on your VPS."
