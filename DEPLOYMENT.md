# Deployment Guide

## Overview
The app is a standard Next.js 14 application (App Router) with Prisma.
Interactive runtime requirements:
- Node.js 20+
- A database reachable via `DATABASE_URL`
- A persistent location for uploaded documents (local volume or S3)

**Environments:** **Production** uses `docker-compose.production.yml` + `.env.production` (port **3000**). **Staging** uses `docker-compose.staging.yml` + `.env.staging` (port **3001**, separate DB/Redis volumes) for full QA before promoting a deploy zip to live. See [Staging environment](#staging-environment-pre-production) below.

## Environment variables
Copy `.env.production.example` to `.env.production` on the server and fill in secrets.
Docker Compose loads `.env.production` for `db`, `app`, and `worker-email`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` / `DIRECT_URL` | yes | Use host `db` inside Docker (see example file) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes (Docker) | Must match credentials in `DATABASE_URL` |
| `REDIS_URL` | yes (Docker stack) | `redis://redis:6379` (also set in compose for app/worker) |
| `NEXTAUTH_URL` / `PUBLIC_BASE_URL` | yes | Public HTTPS URL (e.g. `https://tms.shunlink.in`) |
| `NEXTAUTH_SECRET` | yes | Random secret; generate with `openssl rand -base64 32` |
| `RESEND_API_KEY` / `MAIL_FROM` | for email | Resend; emails are sent by `worker-email` |
| `NOTIFY_PROVIDER` | for WhatsApp | `whatsapp_cloud` for driver OTP and vendor messages |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | if WhatsApp | Meta WhatsApp Cloud API credentials |
| `INTEGRATION_MODE` | no | `mock` (default) until Surepass is configured |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `S3_BUCKET` / `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | if S3 | Object storage config |
| `MAPS_PROVIDER` | no | `osm` (default tiles), `google`, `mapbox`, or `here` |
| `GOOGLE_MAPS_API_KEY` | if google | Google Geocoding / Directions |
| `HERE_API_KEY` | if here | HERE Geocoding + Routing v8 (server) |
| `NEXT_PUBLIC_HERE_API_KEY` | if here | HERE Maps JS (browser-restricted key) |
| `CHROME_PATH` | Docker PDFs | Set automatically in the production image (`/usr/bin/chromium`). LR/invoice PDFs use headless Chromium via `puppeteer-core`. On Windows dev, Chrome/Edge is auto-detected; optional override. |

## VPS code deploy (keep `docker-compose.yml` and `.env.production`)

Deploy zips **do not** include `docker-compose.yml` or env files (see `scripts/package-deploy.ps1`).
If you extract into an empty folder or run `rsync --delete` without those files, production compose is removed.

**Safe update on the server:**

```bash
cd /path/to/tms
./scripts/vps-apply-deploy.sh /path/to/tms-deploy-*.zip
```

**Wrong filename:** `docker.compose.yml` (dot) is **not** used by Docker. Remove it and use `docker-compose.yml` (hyphen).

**If `docker-compose.yml` is missing or empty** (data volumes are usually still fine — do not run `docker compose down -v`):

```bash
cd /path/to/tms
cp docker-compose.production.yml docker-compose.yml   # from repo or new zip
# Restore .env.production from backup if it was lost too
docker compose up -d --build
```

## Option A — Docker (app + PostgreSQL + Redis + email worker)
```bash
cp .env.production.example .env.production
# Edit .env.production (secrets, URLs, Resend, WhatsApp)
cp docker-compose.production.yml docker-compose.yml   # first time on VPS
ln -sf .env.production .env   # so `docker compose` can substitute vars if needed

docker compose up -d --build

# First-time empty DB only — WIPES ALL DATA (demo users, password admin123)
docker compose exec app npm run db:seed

docker compose logs -f app worker-email
```
Data persists in `tms_db`, `tms_uploads`, and `tms_redis` volumes.
The `app` container applies migrations on startup (`prisma migrate deploy`).
Put HTTPS reverse proxy on the host → `http://127.0.0.1:3000` (compose binds app to localhost only).

**HTTP 502 from the domain** usually means the proxy cannot reach the app. On the VPS:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health   # expect 200
docker compose ps    # app should be Up (healthy)
sudo tail -20 /var/log/nginx/error.log   # or: journalctl -u caddy -n 30
```

If `curl` returns **200** but the browser shows **502**, fix Nginx/Caddy `proxy_pass` to `http://127.0.0.1:3000` and reload the proxy. If `curl` fails, recreate the app: `docker compose up -d --force-recreate app`.

The production `Dockerfile` installs `openssl` on Alpine so Prisma can run migrations and the email worker can use the query engine.

## Staging environment (pre-production)

Use staging to run the **full Docker stack** (app, Postgres, Redis, email worker) against **isolated data** before deploying the same zip to production.

| | Production | Staging |
|---|------------|---------|
| Compose file | `docker-compose.production.yml` | `docker-compose.staging.yml` |
| Env file | `.env.production` | `.env.staging` (from `.env.staging.example`) |
| App port (host) | `127.0.0.1:3000` | `127.0.0.1:3001` |
| Postgres (host) | `127.0.0.1:5432` | `127.0.0.1:5434` |
| Redis (host) | `127.0.0.1:6379` | `127.0.0.1:6380` |
| Volumes | `tms_db`, `tms_uploads`, `tms_redis` | `tms_staging_*` (Compose project `tms-staging`) |
| DB user / database | `tms` / `tms` | `tms_staging` / `tms_staging` (set in compose + env) |

**First-time setup (staging server or separate directory on same VPS):**

```bash
cd /opt/tms-staging   # not the live /opt/tms directory
git clone …           # or extract deploy zip once
cp .env.staging.example .env.staging
# Edit: POSTGRES_PASSWORD, DATABASE_URL, DIRECT_URL (same password), NEXTAUTH_*, Resend, URLs
openssl rand -base64 32   # paste into NEXTAUTH_SECRET
ln -sf .env.staging .env
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml exec app npm run db:seed   # empty DB only
curl -sS http://127.0.0.1:3001/api/health
```

Point HTTPS staging vhost at `http://127.0.0.1:3001` (e.g. `staging.tms.shunlink.in`). Update `NEXTAUTH_URL` and `PUBLIC_BASE_URL` in `.env.staging` to match.

**Promote a build after QA:**

1. Create deploy zip locally: `npm run package:deploy`
2. On staging: `./scripts/vps-apply-deploy-staging.sh /path/to/tms-deploy-*.zip`
3. Run regression / feature tests on staging
4. On production: `./scripts/vps-apply-deploy.sh` with the **same zip** (live `.env.production` and compose unchanged)

**Local Windows (optional):** copy `.env.staging.example` → `.env.staging`, adjust secrets, then `npm run docker:staging`.

**Password rule:** `POSTGRES_PASSWORD` in `.env.staging` must match the password embedded in `DATABASE_URL` and `DIRECT_URL`. The `db` service also reads `${POSTGRES_PASSWORD}` from that file (compose default `tms_staging_change_me` is for first boot only — change before going shared).

## Option B — Node on a VM (against managed Postgres)
```bash
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy     # apply migrations to DATABASE_URL
npm run db:seed               # only for first install / demo
NODE_ENV=production npm run start
```
Run under a process manager (systemd/PM2) and put Nginx/Caddy in front for TLS.

## Provisioning PostgreSQL
1. Provision PostgreSQL (RDS/Cloud SQL/managed, or `docker compose up -d db`).
2. Set `DATABASE_URL` to the Postgres connection string, e.g.
   `postgresql://user:pass@host:5432/tms?schema=public`.
3. Apply migrations: `npx prisma migrate deploy`.

## Database `P1000` / password authentication failed

1. **Compose overrode `DATABASE_URL`** — `environment:` in compose used `${POSTGRES_PASSWORD}` from `.env`, while secrets live in `.env.production`. Fix: update `docker-compose.yml` from `docker-compose.production.yml` (newer file does not override DB URLs), then:
   ```bash
   ln -sf .env.production .env
   docker compose up -d --force-recreate app worker-email
   ```
2. **Postgres volume already exists** — log line `Skipping initialization` means changing `POSTGRES_PASSWORD` in env does **not** change the DB password. Either put the **old** password back in `DATABASE_URL`, or align the DB user (data kept):
   ```bash
   docker compose exec db psql -U tms -d tms -c "ALTER USER tms WITH PASSWORD 'YOUR_POSTGRES_PASSWORD';"
   docker compose restart app
   ```
3. In `.env.production`, use **unquoted** URLs, e.g. `DATABASE_URL=postgresql://tms:secret@db:5432/tms?schema=public` (no surrounding `"`).

## Health check
`GET /api/health` returns `200` with `{ status: "ok", db: "up" }` when the
database is reachable, or `503` when it is not. Use it for load balancer and
container health probes.

## Security checklist
- [ ] Set a strong `NEXTAUTH_SECRET`
- [ ] Serve over HTTPS (`NEXTAUTH_URL` must be the https URL)
- [ ] Restrict database network access to the app
- [ ] Configure S3 bucket policies (private + signed URLs) if using S3
- [ ] Enable provider-side rate limiting/WAF in front of `/api/auth`
- [ ] Rotate the seeded demo passwords (`npm run db:seed` sets `admin123`) or
      delete demo users before going live

## Backup
- **PostgreSQL:** use managed automated backups (or `pg_dump` for self-hosted).
- **Uploads:** replicate the storage bucket/volume (`STORAGE_DRIVER=s3` recommended).
