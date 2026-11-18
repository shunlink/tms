#!/usr/bin/env bash
# Backup TMS production data: PostgreSQL dump, uploads volume, optional Redis snapshot.
#
# Run on the SOURCE VPS from the TMS app directory (contains docker-compose.yml).
#
# Usage:
#   chmod +x scripts/server-migration/backup.sh
#   ./scripts/server-migration/backup.sh
#   ./scripts/server-migration/backup.sh /var/backups/tms-migration
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_ROOT="${1:-$APP_DIR/backups/migration}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$BACKUP_ROOT/tms-$TIMESTAMP"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-tms}"
POSTGRES_DB="${POSTGRES_DB:-tms}"
COMPOSE=(docker compose)
if [[ -f docker-compose.yml ]]; then
  :
elif [[ -f docker-compose.production.yml ]]; then
  COMPOSE=(docker compose -f docker-compose.production.yml)
else
  echo "No docker-compose.yml or docker-compose.production.yml in $APP_DIR" >&2
  exit 1
fi

mkdir -p "$RUN_DIR"

echo "==> Stopping app + worker (DB stays up for consistent dump)"
"${COMPOSE[@]}" stop app worker-email 2>/dev/null || true

cleanup() {
  "${COMPOSE[@]}" start app worker-email 2>/dev/null || true
}
trap cleanup EXIT

echo "==> PostgreSQL dump (custom format)"
if ! "${COMPOSE[@]}" ps --status running db 2>/dev/null | grep -q db; then
  echo "db service is not running — start the stack first." >&2
  exit 1
fi

"${COMPOSE[@]}" exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-acl \
  > "$RUN_DIR/postgres.dump"

echo "==> Prisma migration history (sanity check)"
"${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at NULLS LAST, started_at;" \
  > "$RUN_DIR/prisma_migrations.txt" || true

echo "==> Uploads volume (tms_uploads)"
UPLOADS_VOLUME="$("${COMPOSE[@]}" volume ls -q | grep -E 'tms_uploads$|_tms_uploads$' | head -n1 || true)"
if [[ -n "$UPLOADS_VOLUME" ]]; then
  docker run --rm \
    -v "${UPLOADS_VOLUME}:/data:ro" \
    -v "$RUN_DIR:/backup" \
    alpine:3.22 \
    sh -c "tar -C /data -czf /backup/tms_uploads.tar.gz ."
else
  echo "WARN: tms_uploads volume not found — skipping uploads archive." >&2
fi

echo "==> Redis RDB (optional queue state)"
REDIS_VOLUME="$("${COMPOSE[@]}" volume ls -q | grep -E 'tms_redis$|_tms_redis$' | head -n1 || true)"
if [[ -n "$REDIS_VOLUME" ]]; then
  if "${COMPOSE[@]}" ps --status running redis 2>/dev/null | grep -q redis; then
    "${COMPOSE[@]}" exec -T redis redis-cli SAVE >/dev/null || true
  fi
  docker run --rm \
    -v "${REDIS_VOLUME}:/data:ro" \
    -v "$RUN_DIR:/backup" \
    alpine:3.22 \
    sh -c "tar -C /data -czf /backup/tms_redis.tar.gz ."
else
  echo "WARN: tms_redis volume not found — skipping Redis." >&2
fi

# Metadata for restore (no secrets)
cat > "$RUN_DIR/manifest.env" <<EOF
BACKUP_TIMESTAMP=$TIMESTAMP
POSTGRES_USER=$POSTGRES_USER
POSTGRES_DB=$POSTGRES_DB
SOURCE_HOST=$(hostname -f 2>/dev/null || hostname)
APP_DIR=$APP_DIR
EOF

(
  cd "$BACKUP_ROOT"
  tar -czf "tms-$TIMESTAMP.bundle.tar.gz" -C "$RUN_DIR" .
)

echo ""
echo "Backup complete:"
echo "  Directory: $RUN_DIR"
echo "  Bundle:    $BACKUP_ROOT/tms-$TIMESTAMP.bundle.tar.gz"
echo ""
echo "Copy bundle + .env.production to the new server (use scp/rsync over SSH)."
echo "Do NOT commit dumps or env files to git."