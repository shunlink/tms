#!/usr/bin/env bash
# Copy a TMS migration bundle from source VPS to target VPS over SSH.
#
# Usage:
#   ./scripts/server-migration/transfer.sh \
#     /path/to/tms-YYYYMMDDTHHMMSS.bundle.tar.gz \
#     deployuser@NEW_SERVER_IP:/opt/tms/incoming/
#
# Also copies .env.production if SOURCE_ENV is set (default: ./.env.production next to compose).
#
set -euo pipefail

BUNDLE="${1:?Usage: $0 BUNDLE.tar.gz user@host:/remote/dir/}"
DEST="${2:?}"

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE_ENV="${SOURCE_ENV:-$APP_DIR/.env.production}"

if [[ ! -f "$BUNDLE" ]]; then
  echo "Bundle not found: $BUNDLE" >&2
  exit 1
fi

echo "==> rsync bundle"
rsync -avP --progress "$BUNDLE" "$DEST"

if [[ -f "$SOURCE_ENV" ]]; then
  echo "==> rsync .env.production (review URLs/secrets on target before going live)"
  rsync -avP --progress "$SOURCE_ENV" "${DEST%/}/.env.production.from-source"
else
  echo "WARN: $SOURCE_ENV not found — copy secrets manually." >&2
fi

echo "Done. On target:"
echo "  mkdir -p /opt/tms && cd /opt/tms"
echo "  ./scripts/server-migration/restore.sh $(basename "$BUNDLE")"