#!/usr/bin/env bash
# Apply a deploy zip on the VPS without touching server-only files.
#
# Usage (on VPS, from app directory):
#   chmod +x scripts/vps-apply-deploy.sh
#   ./scripts/vps-apply-deploy.sh /path/to/tms-deploy-YYYYMMDD-HHMM.zip
#
set -euo pipefail

ZIP="${1:?Usage: $0 /path/to/tms-deploy.zip}"
APP_DIR="${2:-$(cd "$(dirname "$0")/.." && pwd)}"

cd "$APP_DIR"

if [[ ! -f "$ZIP" ]]; then
  echo "Zip not found: $ZIP" >&2
  exit 1
fi

# Never overwrite live secrets or the compose file you may have customized.
unzip -o "$ZIP" \
  -x 'docker-compose.yml' \
  -x '.env' \
  -x '.env.production' \
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

if [[ ! -f docker-compose.yml ]]; then
  if [[ -f docker-compose.production.yml ]]; then
    echo "No docker-compose.yml — creating from docker-compose.production.yml"
    cp docker-compose.production.yml docker-compose.yml
  else
    echo "Missing docker-compose.yml and docker-compose.production.yml — fix before compose up." >&2
    exit 1
  fi
fi

docker compose build
docker compose up -d

echo "Done. Logs: docker compose logs -f app worker-email"
