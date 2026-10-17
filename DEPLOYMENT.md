# Deployment Guide

## Overview
The app is a standard Next.js 14 application (App Router) with Prisma.
Interactive runtime requirements:
- Node.js 20+
- A database reachable via `DATABASE_URL`
- A persistent location for uploaded documents (local volume or S3)

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
| `MAPS_PROVIDER` | no | `nominatim` (default, free) or `google` |
| `GOOGLE_MAPS_API_KEY` | if google | Google Geocoding API key |

## Option A — Docker (app + PostgreSQL + Redis + email worker)
```bash
cp .env.production.example .env.production
# Edit .env.production (secrets, URLs, Resend, WhatsApp)

docker compose up -d --build

# First-time empty DB only — WIPES ALL DATA (demo users, password admin123)
docker compose exec app npm run db:seed

docker compose logs -f app worker-email
```
Data persists in `tms_db`, `tms_uploads`, and `tms_redis` volumes.
The `app` container applies migrations on startup (`prisma migrate deploy`).
Put HTTPS reverse proxy on the host → `127.0.0.1:3000`.

The production `Dockerfile` installs `openssl` on Alpine so Prisma can run migrations and the email worker can use the query engine.

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
