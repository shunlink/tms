# Database migration (v1 → SaaS schema)

The SaaS schema is a **full redesign** (normalized indent cluster, `tenantId` on all tables). Prisma cannot add required columns like `tenantId` to existing v1 rows automatically.

## Local development (recommended)

Reset the database and apply the fresh migration + seed:

```bash
npm run db:reset
```

This runs `prisma migrate reset --force` then `tsx prisma/seed.ts`.

Demo login after seed: `admin@tms.local` / `admin123` (tenant: `shunlink`).

## Fresh install

```bash
npm run db:migrate
npm run db:seed
```

## Production with existing v1 data

You must either:

1. **Greenfield deploy** — new database, run `npm run db:migrate:deploy` + seed tenants, then migrate business data with a custom ETL script.
2. **Accept data loss** — `prisma migrate reset` on a staging copy first, validate, then production cutover.

There is no safe additive migration from the old wide `Indent` table to the new normalized schema without a manual data migration script.

## If `prisma migrate dev` shows "cannot add required column without default"

Do **not** use `migrate dev` to patch v1 data in place. Use `npm run db:reset` locally, or `prisma migrate dev --create-only` and hand-write SQL that backfills `tenantId` before setting `NOT NULL` (only if you must preserve rows).
