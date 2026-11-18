#!/usr/bin/env bash
# Restore TMS data from scripts/server-migration/backup.sh output on a NEW VPS.
#
# Prerequisites on target:
#   - Docker installed, TMS code deployed, .env.production created (same DB user/db name as source OR adjust manifest)
#   - Empty Postgres volume (first `docker compose up -d db` only) OR you accept --clean wipe of public schema data
#
# Usage:
#   ./scripts/server-migration/restore.sh /path/to/tms-YYYYMMDDTHHMMSS.bundle.tar.gz
#
set -euo pipefail

BUNDLE="${1:?Usage: $0 /path/to/tms-*.bundle.tar.gz}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
WORK="$(mktemp -d)"

cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create from .env.production.example first." >&2
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
  cp -n docker-compose.production.yml docker-compose.yml 2>/dev/null || cp docker-compose.production.yml docker-compose.yml
else
  echo "No compose file in $APP_DIR" >&2
  exit 1
fi

mkdir -p "$WORK"
tar -xzf "$BUNDLE" -C "$WORK"

if [[ ! -f "$WORK/postgres.dump" ]]; then
  echo "Invalid bundle: postgres.dump missing" >&2
  exit 1
fi

echo "==> Start database only"
"${COMPOSE[@]}" up -d db redis
echo "Waiting for Postgres..."
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Restore PostgreSQL (pg_restore --clean --if-exists)"
"${COMPOSE[@]}" stop app worker-email 2>/dev/null || true

cat "$WORK/postgres.dump" | "${COMPOSE[@]}" exec -T db pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --verbose

echo "==> Restore uploads volume"
if [[ -f "$WORK/tms_uploads.tar.gz" ]]; then
  UPLOADS_VOLUME="$("${COMPOSE[@]}" volume ls -q | grep -E 'tms_uploads$|_tms_uploads$' | head -n1 || true)"
  if [[ -z "$UPLOADS_VOLUME" ]]; then
    "${COMPOSE[@]}" up -d --no-start app 2>/dev/null || true
    UPLOADS_VOLUME="$("${COMPOSE[@]}" volume ls -q | grep -E 'tms_uploads$|_tms_uploads$' | head -n1 || true)"
  fi
  if [[ -n "$UPLOADS_VOLUME" ]]; then
    docker run --rm \
      -v "${UPLOADS_VOLUME}:/data" \
      -v "$WORK:/backup:ro" \
      alpine:3.22 \
      sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xzf /backup/tms_uploads.tar.gz -C /data"
  fi
fi

echo "==> Restore Redis (optional)"
if [[ -f "$WORK/tms_redis.tar.gz" ]]; then
  REDIS_VOLUME="$("${COMPOSE[@]}" volume ls -q | grep -E 'tms_redis$|_tms_redis$' | head -n1 || true)"
  if [[ -n "$REDIS_VOLUME" ]]; then
    "${COMPOSE[@]}" stop redis 2>/dev/null || true
    docker run --rm \
      -v "${REDIS_VOLUME}:/data" \
      -v "$WORK:/backup:ro" \
      alpine:3.22 \
      sh -c "rm -f /data/*; tar -xzf /backup/tms_redis.tar.gz -C /data"
    "${COMPOSE[@]}" start redis 2>/dev/null || true
  fi
fi

echo "==> Start full stack (migrations should be no-op if dump is current)"
ln -sf .env.production .env 2>/dev/null || true
"${COMPOSE[@]}" up -d --build

echo "==> Health check"
sleep 5
curl -sf "http://127.0.0.1:3000/api/health" || {
  echo "Health check failed — inspect: docker compose logs -f app" >&2
  exit 1
}

echo "Restore complete. Point Nginx/Caddy to 127.0.0.1:3000 and update DNS when verified."