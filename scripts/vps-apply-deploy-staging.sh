#!/usr/bin/env bash
# Apply a deploy zip to the STAGING stack without touching server-only files.
#
# Usage (on VPS, from staging app directory, e.g. /opt/tms-staging):
#   chmod +x scripts/vps-apply-deploy-staging.sh
#   ./scripts/vps-apply-deploy-staging.sh /path/to/tms-deploy-YYYYMMDD-HHMM.zip
#
set -euo pipefail

ZIP="${1:?Usage: $0 /path/to/tms-deploy.zip}"
APP_DIR="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="docker-compose.staging.yml"

cd "$APP_DIR"

if [[ ! -f "$ZIP" ]]; then
  echo "Zip not found: $ZIP" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $COMPOSE_FILE — deploy zip must include docker-compose.staging.yml." >&2
  exit 1
fi

if [[ ! -f .env.staging ]]; then
  echo "Missing .env.staging — copy from .env.staging.example and configure secrets." >&2
  exit 1
fi

unzip -o "$ZIP" \
  -x 'docker-compose.yml' \
  -x '.env' \
  -x '.env.production' \
  -x '.env.staging' \
  -x '.env.local'

STALE_LIST="$APP_DIR/scripts/deploy-stale-paths.txt"
if [[ -f "$STALE_LIST" ]]; then
  while IFS= read -r rel || [[ -n "$rel" ]]; do
    rel="${rel%%#*}"
    rel="$(echo "$rel" | xargs)"
    [[ -z "$rel" ]] && continue
    if [[ -e "$APP_DIR/$rel" ]]; then
      rm -f "$APP_DIR/$rel"
      echo "Removed stale deploy file: $rel"
    fi
  done < "$STALE_LIST"
fi

ln -sf .env.staging .env

docker compose -f "$COMPOSE_FILE" build
docker compose -f "$COMPOSE_FILE" up -d

echo "Staging deploy applied. Health: curl -sS http://127.0.0.1:3001/api/health"
echo "Logs: docker compose -f $COMPOSE_FILE logs -f app worker-email"
