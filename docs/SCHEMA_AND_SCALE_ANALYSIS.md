# TMS — Schema & Scale Analysis

**Version:** 1.0  
**Status:** Living document  
**Last updated:** September 2026

---

## 1. Current Schema Overview

The TMS database has **16 Prisma models** backed by PostgreSQL 16. This section analyzes the existing schema, identifies gaps for the target product, and proposes changes.

### 1.1 Entity relationship diagram (current)

```mermaid
erDiagram
    User ||--o| Client : "clientId"
    User ||--o| Vendor : "vendorId"
    User ||--o| Driver : "driverId"

    Client ||--o{ Requirement : "raises"
    Client ||--o{ Indent : "owns"
    Client ||--o{ Trip : "ships"
    Client ||--o{ ClientInvoice : "billed"
    Client ||--o{ Document : "KYC docs"

    Vendor ||--o{ Vehicle : "owns"
    Vendor ||--o{ Trip : "executes"
    Vendor ||--o{ VendorPayment : "paid"
    Vendor ||--o{ Indent : "allocated"
    Vendor ||--o{ Document : "KYC docs"

    Vehicle ||--o{ Trip : "used in"
    Vehicle ||--o{ Indent : "assigned to"
    Vehicle ||--o{ Document : "compliance docs"

    Driver ||--o{ Trip : "drives"
    Driver ||--o{ Indent : "assigned to"
    Driver ||--o{ Document : "license docs"

    Requirement ||--o{ Trip : "legacy link"
    Indent ||--o| Trip : "converts to"
    Indent ||--o{ Document : "attachments"

    Trip ||--o{ Document : "LR, POD, e-way"
    Trip ||--o{ TrackingPing : "GPS"
    Trip ||--o{ Notification : "alerts"
    Trip ||--o{ VendorPayment : "payable"
    Trip ||--o| ClientInvoice : "invoiced"

    ClientInvoice ||--o{ Trip : "covers"
```

### 1.2 Model inventory

| Model | Records (est. at scale) | Growth rate | Hot/Cold |
|-------|------------------------|-------------|----------|
| User | ~500 | Slow | Hot (auth) |
| Client | ~200 | Slow | Warm |
| Vendor | ~500 | Slow | Warm |
| Vehicle | ~5,000 | Medium | Warm |
| Driver | ~2,000 | Medium | Warm |
| Requirement | ~50/day → ~18K/year | Low (0.1% self-service) | Warm |
| Indent | ~500/day → ~180K/year | **High** | **Hot** |
| Trip | ~500/day → ~180K/year | **High** | **Hot** |
| Document | ~5/trip → ~900K/year | **High** | Cold (blob refs) |
| ClientInvoice | ~500/day → ~180K/year | High | Warm |
| VendorPayment | ~500/day → ~180K/year | High | Warm |
| TrackingPing | ~10/trip → ~1.8M/year | **Very High** | Cold (time-series) |
| Notification | ~3/event → ~500K/year | High | Cold |
| AuditLog | ~5/mutation → ~2M/year | **Very High** | Cold |
| Advance | ~100/day → ~36K/year | Medium | Warm |

---

## 2. Schema Gaps & Proposed Changes

### 2.1 New models required

#### VendorQuote (P0 — Phase 1)

```prisma
model VendorQuote {
  id          String   @id @default(cuid())
  indentId    String
  indent      Indent   @relation(fields: [indentId], references: [id])
  vendorId    String
  vendor      Vendor   @relation(fields: [vendorId], references: [id])
  vehicleId   String?
  vehicle     Vehicle? @relation(fields: [vehicleId], references: [id])
  quotedRate  Decimal
  channel     String   // PORTAL | WHATSAPP
  status      String   @default("ACTIVE") // ACTIVE | SUPERSEDED | ACCEPTED | REJECTED
  remarks     String?
  submittedAt DateTime @default(now())
  createdAt   DateTime @default(now())

  @@unique([indentId, vendorId])
  @@index([indentId, status])
  @@index([indentId, quotedRate])
}
```

**Design notes:**
- `@@unique([indentId, vendorId])` enforces one quote per vendor per indent
- `submittedAt` is the first-wins timestamp (set at INSERT, never updated)
- `channel` is immutable after creation — determines which path the vendor used
- Race condition handled by: unique constraint + `INSERT ... ON CONFLICT DO NOTHING` + return existing if conflict

#### Permission / RolePermission / UserPermission (P2 — Phase 3)

```prisma
model Permission {
  id     String @id @default(cuid())
  key    String @unique  // "indent.approve", "vehicle.verify"
  label  String
  module String          // "indents", "vehicles", "finance"

  rolePermissions RolePermission[]
  userPermissions UserPermission[]
}

model RolePermission {
  role         String
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@id([role, permissionId])
}

model UserPermission {
  userId       String
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id])
  granted      Boolean  // true = grant, false = explicit deny

  @@id([userId, permissionId])
}
```

### 2.2 Modifications to existing models

#### Indent — add requirement link

```prisma
// Add to Indent model:
requirementId  String?
requirement    Requirement? @relation(fields: [requirementId], references: [id])
quoteDeadline  DateTime?    // when quoting window closes
quotes         VendorQuote[]
```

#### Requirement — add conversion tracking

```prisma
// Add to Requirement model:
convertedToIndentId String?   // FK to indent once converted
convertedAt         DateTime?
// Status values: OPEN | CONVERTED | CANCELLED
```

#### Vehicle — add verification workflow

```prisma
// Add to Vehicle model:
verificationStatus  String    @default("PENDING") // PENDING | SUBMITTED | APPROVED | REJECTED
verificationRemarks String?
verifiedAt          DateTime?
verifiedBy          String?
```

#### Driver — source, device type, certification (P1 — Phase 2)

```prisma
// Add to Driver model:
driverSource         String    @default("VENDOR")  // VENDOR | POOL | INDEPENDENT
vendorId             String?   // set when source = VENDOR (vendor who registered them)
deviceType           String    @default("SMARTPHONE") // SMARTPHONE | FEATURE_PHONE
certificationStatus  String    @default("NONE") // NONE | IN_PROGRESS | CERTIFIED
shunAssistUserId     String?   // link to ShunAssist profile (pool + course tracking)
subscriptionPlanId   String?   // TBD — independent driver plan (ShunAssist)
```

**Driver source semantics:**

| `driverSource` | Created by | Trip access | App home screen |
|--------------|------------|-------------|-----------------|
| `VENDOR` | Vendor portal registration | After admin KYC approval | Trips |
| `POOL` | ShunAssist assignment | When assigned to trip | Trips |
| `INDEPENDENT` | Self-registration on app | After ShunAssist certification | Courses/plans until certified |

#### Trip — add driver source & tracking mode

```prisma
// Add to Trip model:
driverSource    String?  // VENDOR | POOL | INDEPENDENT
trackingMode    String?  // GPS | CELL (derived from driver.deviceType at trip start)
```

#### Indent — add driver source tracking

```prisma
// Add to Indent model:
driverSource          String?   // VENDOR | POOL | INDEPENDENT
poolDriverRequestId   String?   // ShunAssist request reference
```

#### TrackingPing — add location source & accuracy

```prisma
// Add to TrackingPing model:
source          String   @default("GPS")  // GPS | CELL
accuracyMeters  Float?   // null for GPS; populated for cell triangulation
```

### 2.3 Updated entity relationship (target)

```mermaid
erDiagram
    Requirement ||--o| Indent : "converts to"
    Indent ||--o{ VendorQuote : "receives quotes"
    Vendor ||--o{ VendorQuote : "submits"
    Vehicle ||--o{ VendorQuote : "offered vehicle"

    Indent {
        string id
        string requirementId FK
        string status
        datetime quoteDeadline
        string driverSource
    }

    VendorQuote {
        string id
        string indentId FK
        string vendorId FK
        decimal quotedRate
        string channel
        datetime submittedAt
    }

    Vehicle {
        string verificationStatus
        datetime verifiedAt
    }

    Driver {
        string driverSource
        string deviceType
        string certificationStatus
        string vendorId FK
    }

    TrackingPing {
        string source
        float accuracyMeters
    }

    Permission ||--o{ RolePermission : "assigned to role"
    Permission ||--o{ UserPermission : "assigned to user"
```

---

## 3. Index Strategy

### 3.1 Existing indexes (from migration)

Only primary keys and unique constraints exist today. No secondary indexes on frequently queried columns.

### 3.2 Recommended indexes (add in Phase 0)

```sql
-- Trip queries (most frequent)
CREATE INDEX idx_trip_status ON "Trip" ("status");
CREATE INDEX idx_trip_client_id ON "Trip" ("clientId");
CREATE INDEX idx_trip_vendor_id ON "Trip" ("vendorId");
CREATE INDEX idx_trip_driver_id ON "Trip" ("driverId");
CREATE INDEX idx_trip_created_at ON "Trip" ("createdAt" DESC);

-- Indent queries
CREATE INDEX idx_indent_status ON "Indent" ("status");
CREATE INDEX idx_indent_stage ON "Indent" ("stage");
CREATE INDEX idx_indent_client_id ON "Indent" ("clientId");
CREATE INDEX idx_indent_vendor_id ON "Indent" ("vendorId");
CREATE INDEX idx_indent_created_at ON "Indent" ("createdAt" DESC);

-- Onboarding queues
CREATE INDEX idx_client_onboarding ON "Client" ("onboardingStatus") WHERE "onboardingStatus" != 'APPROVED';
CREATE INDEX idx_vendor_onboarding ON "Vendor" ("onboardingStatus") WHERE "onboardingStatus" != 'APPROVED';
CREATE INDEX idx_driver_onboarding ON "Driver" ("onboardingStatus") WHERE "onboardingStatus" != 'APPROVED';
CREATE INDEX idx_vehicle_verification ON "Vehicle" ("verificationStatus") WHERE "verificationStatus" != 'APPROVED';

-- Financial queries
CREATE INDEX idx_invoice_status ON "ClientInvoice" ("status");
CREATE INDEX idx_invoice_client_id ON "ClientInvoice" ("clientId");
CREATE INDEX idx_payment_status ON "VendorPayment" ("status");
CREATE INDEX idx_payment_vendor_id ON "VendorPayment" ("vendorId");

-- Tracking (time-series, partition later)
CREATE INDEX idx_tracking_trip_id ON "TrackingPing" ("tripId", "createdAt" DESC);

-- Notifications outbox
CREATE INDEX idx_notification_status ON "Notification" ("status") WHERE "status" = 'PENDING';

-- Audit log (append-only, query by entity)
CREATE INDEX idx_audit_entity ON "AuditLog" ("entity", "entityId");
CREATE INDEX idx_audit_created_at ON "AuditLog" ("createdAt" DESC);

-- Vendor quotes (new)
CREATE INDEX idx_quote_indent_rate ON "VendorQuote" ("indentId", "quotedRate");
CREATE INDEX idx_quote_vendor ON "VendorQuote" ("vendorId", "submittedAt" DESC);
```

### 3.3 Index impact estimate

| Table | Rows (year 1) | Index overhead | Query improvement |
|-------|---------------|----------------|-------------------|
| Trip | 180K | ~15 MB | List/filter: 200ms → 5ms |
| Indent | 180K | ~12 MB | Board view: 150ms → 3ms |
| TrackingPing | 1.8M | ~80 MB | Trip tracking: 500ms → 10ms |
| AuditLog | 2M | ~100 MB | Entity history: 300ms → 15ms |

Total additional storage: ~250 MB (negligible on modern Postgres).

---

## 4. Connection Pooling

### 4.1 Current state

```typescript
// src/lib/prisma.ts — default Prisma client, no pool config
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
```

Problems:
- Each Next.js server instance opens its own connection pool (default: `num_cpus * 2 + 1` connections)
- With 3 app instances: potentially 30+ direct connections to Postgres
- Postgres default `max_connections = 100` — exhausted quickly under load
- No connection reuse across serverless function invocations (if deployed to Vercel)

### 4.2 Recommended setup

```mermaid
graph LR
    APP1["App Instance 1<br/>(pool: 5)"] --> PGB["PgBouncer<br/>(transaction mode)"]
    APP2["App Instance 2<br/>(pool: 5)"] --> PGB
    APP3["App Instance N<br/>(pool: 5)"] --> PGB
    PGB -->|"pool: 20-30"| PG["PostgreSQL<br/>(max_connections: 100)"]
```

**PgBouncer configuration:**

```ini
[databases]
tms = host=postgres port=5432 dbname=tms

[pgbouncer]
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
```

**Prisma configuration:**

```env
# Use PgBouncer URL for app connections
DATABASE_URL="postgresql://tms:pass@pgbouncer:6432/tms?pgbouncer=true&connection_limit=5"

# Direct URL for migrations (bypasses PgBouncer)
DIRECT_URL="postgresql://tms:pass@postgres:5432/tms"
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 4.3 Connection budget

| Component | Connections | Notes |
|-----------|-------------|-------|
| App instance 1 | 5 | Prisma `connection_limit=5` |
| App instance 2 | 5 | |
| App instance 3 | 5 | |
| PgBouncer → Postgres | 20 | Shared pool |
| Migration runner | 1 | Direct connection |
| Monitoring (pg_stat) | 1 | |
| Admin/psql | 2 | |
| **Total to Postgres** | **~24** | Well within 100 limit |

With 10 app instances: PgBouncer still uses only 20-30 Postgres connections.

---

## 5. Caching Strategy

### 5.1 What to cache

```mermaid
graph TB
    subgraph "Cache in Redis"
        C1["Dashboard KPIs<br/>TTL: 60s"]
        C2["Master data lists<br/>(clients, vendors, vehicles)<br/>TTL: 5min"]
        C3["User session data<br/>TTL: 15min"]
        C4["Rate limit counters<br/>TTL: 5min"]
        C5["Mobile refresh tokens<br/>TTL: 7d"]
        C6["Geocode results<br/>TTL: 24h"]
    end

    subgraph "Never cache"
        N1["Trip/indent writes"]
        N2["Financial transactions"]
        N3["POD uploads"]
        N4["Quote submissions"]
        N5["Audit log writes"]
    end
```

### 5.2 Cache implementation pattern

```typescript
// src/lib/cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const data = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}

export async function invalidate(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}
```

### 5.3 Cache invalidation rules

| Event | Invalidate |
|-------|-----------|
| Trip status change | `dashboard:*`, `trips:list:*` |
| Indent created/updated | `dashboard:*`, `indents:list:*` |
| Client/vendor/driver CRUD | `masters:{entity}:*` |
| Invoice created/paid | `dashboard:*`, `invoices:list:*` |
| Quote submitted | `indents:{id}:quotes` |

### 5.4 Cache sizing estimate

| Cache type | Key count | Avg size | Total |
|------------|-----------|----------|-------|
| Dashboard KPIs | 1 (global) | 2 KB | 2 KB |
| Master lists | ~10 entities | 50 KB each | 500 KB |
| Rate limits | ~100 active users | 100 B each | 10 KB |
| Refresh tokens | ~500 drivers | 200 B each | 100 KB |
| Geocode | ~1,000 locations | 500 B each | 500 KB |
| **Total** | | | **~1.2 MB** |

Redis instance: **256 MB** is more than sufficient for years.

---

## 6. Performance Analysis & Fixes

### 6.1 Root causes of slow page loads

| # | Issue | Impact | Location | Fix |
|---|-------|--------|----------|-----|
| P1 | `force-dynamic` on all 50+ pages | Every navigation = full server render + DB query | All `page.tsx` files | Remove where safe; add `revalidate: 60` for master data |
| P2 | No server-side pagination | `getTrips()` loads ALL trips into memory | `queries.ts` — 45 `findMany` without `take` | Add `take`/`skip` + `count()` to all list queries |
| P3 | Dashboard runs 14 parallel queries | 200-500ms on every `/` load | `getDashboard()` | Cache in Redis (60s TTL); replace full scans with `count()` + `groupBy` |
| P4 | Reports load entire tables | `getLaneRates()` fetches all trips; `getClientProfitability()` fetches all clients with nested trips | `queries.ts` reports section | SQL aggregation; paginate; move to read replica |
| P5 | No database indexes | Sequential scans on 180K+ row tables | Missing indexes | Add indexes (Section 3.2) |
| P6 | Monolithic queries.ts (1,300 lines) | Hard to optimize; no lazy loading | `src/lib/queries.ts` | Split into domain modules |
| P7 | Client-side pagination only | Full dataset serialized to browser on every page load | `data-table.tsx` + list pages | Server-side pagination with URL params |
| P8 | `nextNumber()` race condition | `count() + 1` without locking | `sequence.ts` | Use Postgres sequence or advisory lock |
| P9 | In-memory rate limiter | Doesn't work across instances; resets on restart | `ratelimit.ts` | Move to Redis |
| P10 | No connection pooling | Connection exhaustion under concurrent load | `prisma.ts` | PgBouncer (Section 4) |

### 6.2 Performance fix priority

```mermaid
gantt
    title Performance Fix Timeline
    dateFormat YYYY-MM-DD
    section Critical (Week 1)
    Server-side pagination     :p1, 2026-09-28, 3d
    Database indexes           :p2, 2026-09-28, 1d
    PgBouncer setup            :p3, 2026-09-29, 1d
    section High (Week 2)
    Redis cache layer          :p4, 2026-10-01, 2d
    Dashboard optimization     :p5, 2026-10-01, 2d
    Split queries.ts           :p6, 2026-10-03, 2d
    section Medium (Week 3)
    Remove force-dynamic       :p7, 2026-10-06, 2d
    Fix nextNumber race        :p8, 2026-10-06, 1d
    Redis rate limiter         :p9, 2026-10-08, 1d
```

### 6.3 Expected performance after fixes

| Page | Current (est.) | Target | Method |
|------|---------------|--------|--------|
| Dashboard `/` | 800-1500ms | < 300ms | Redis cache + optimized queries |
| Trip list `/trips` | 500-2000ms | < 200ms | Server pagination (50/page) + index |
| Indent board `/indents/board` | 600-1500ms | < 250ms | Paginated query + index on stage |
| Client portal overview | 400-800ms | < 200ms | Scoped query (already filtered by clientId) |
| Vendor portal trips | 400-800ms | < 200ms | Scoped query + pagination |
| Reports `/reports` | 2000-5000ms | < 1000ms | SQL aggregation + read replica (Phase 4) |

### 6.4 Pagination pattern (standard for all lists)

```typescript
// src/lib/queries/trips.ts
export async function getTripsPaginated(params: {
  page: number;
  pageSize: number;
  status?: string;
  clientId?: string;
  vendorId?: string;
}) {
  const { page, pageSize, status, clientId, vendorId } = params;
  const where = {
    ...(status && { status }),
    ...(clientId && { clientId }),
    ...(vendorId && { vendorId }),
  };

  const [rows, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: { /* only fields needed for table */ },
    }),
    prisma.trip.count({ where }),
  ]);

  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
```

---

## 7. Scale Analysis — How Far Without Sharding?

### 7.1 Capacity model

**Assumptions (full production scale):**
- 200 active clients, 500 active vendors, 2,000 drivers
- 500 indents/trips per day (~180K/year)
- 50 concurrent admin/ops users
- 100 concurrent portal users (clients + vendors)
- 200 concurrent driver app users (peak: morning dispatch)

### 7.2 Database sizing (3-year projection)

| Table | Year 1 | Year 2 | Year 3 | Storage |
|-------|--------|--------|--------|---------|
| Trip | 180K | 360K | 540K | ~200 MB |
| Indent | 180K | 360K | 540K | ~300 MB |
| TrackingPing | 1.8M | 3.6M | 5.4M | ~400 MB |
| Document (metadata) | 900K | 1.8M | 2.7M | ~150 MB |
| AuditLog | 2M | 4M | 6M | ~500 MB |
| Notification | 500K | 1M | 1.5M | ~100 MB |
| All others | ~50K | ~80K | ~100K | ~50 MB |
| **Indexes** | | | | ~500 MB |
| **Total DB** | | | | **~2.2 GB** |

PostgreSQL handles **terabytes** on a single instance. At 2.2 GB after 3 years, the database is nowhere near capacity limits.

### 7.3 Query throughput estimate

| Operation | QPS (peak) | Postgres capacity | Headroom |
|-----------|-----------|-------------------|----------|
| Trip list (paginated) | 50 | 10,000+ simple selects/s | 200x |
| Dashboard KPIs (cached) | 5 (cache hit) | N/A (Redis) | ∞ |
| Trip status update | 20 | 5,000+ writes/s | 250x |
| GPS ping insert | 30 | 5,000+ writes/s | 165x |
| Quote submission | 10 | 5,000+ writes/s | 500x |
| POD upload (metadata) | 5 | 5,000+ writes/s | 1000x |

**Verdict: Single PostgreSQL instance with PgBouncer handles 10-50x the target load.**

### 7.4 When to consider scaling steps

```mermaid
graph LR
    NOW["Now<br/>Single Postgres<br/>+ PgBouncer<br/>+ Redis"] -->|"500 trips/day<br/>50 concurrent users"| STEP1
    STEP1["Step 1<br/>Read replica<br/>for reports"] -->|"2,000 trips/day<br/>200 concurrent users"| STEP2
    STEP2["Step 2<br/>Table partitioning<br/>(TrackingPing,<br/>AuditLog)"] -->|"5,000 trips/day<br/>500 concurrent users"| STEP3
    STEP3["Step 3<br/>Vertical scale<br/>(bigger instance)"] -->|"10,000 trips/day<br/>1,000 concurrent users"| STEP4
    STEP4["Step 4<br/>Consider sharding<br/>(by client or region)"] -->|"50,000+ trips/day"| STEP5
```

| Scale step | Trigger | Action | Cost |
|------------|---------|--------|------|
| **Now** | Launch | Single Postgres + PgBouncer + Redis | Low |
| Step 1 | Reports slow (>2s) or 2K trips/day | Add read replica for analytics | +$50/mo |
| Step 2 | TrackingPing > 10M rows | Partition by month (native Postgres) | Dev effort |
| Step 3 | CPU > 70% sustained | Upgrade instance (2x RAM/CPU) | +$100/mo |
| Step 4 | 10K+ trips/day, multi-region | Shard by region or client segment | Major effort |

### 7.5 Sharding recommendation

**Do NOT shard now.** Reasons:

1. **Data size:** 2.2 GB after 3 years — a single Postgres instance handles this trivially
2. **Query patterns:** Most queries are scoped by `clientId`, `vendorId`, or `status` — indexes make these fast
3. **Complexity cost:** Sharding adds application complexity (cross-shard queries, distributed transactions, rebalancing) that is not justified at this scale
4. **Financial data:** Invoices and payments require ACID transactions — sharding makes this significantly harder
5. **Team size:** A team of 3-4 engineers should focus on features, not distributed database operations

**Revisit sharding when:**
- Single Postgres instance exceeds 80% CPU/RAM sustained
- Daily trip volume exceeds 10,000
- Multi-region deployment is required (latency to different Indian cities)
- Table sizes exceed 100 GB (likely 10+ years at current growth)

### 7.6 Vertical scaling path

For horizontal app scaling (multiple Next.js instances), the architecture is already prepared:

| Component | Scaling strategy |
|-----------|-----------------|
| Next.js app | Stateless (JWT auth) → add instances behind load balancer |
| PostgreSQL | Vertical (bigger instance) → read replica → partition |
| Redis | Single instance sufficient; Redis Cluster if > 1 GB |
| S3 | Infinitely scalable (managed service) |
| PgBouncer | Single instance handles 200+ client connections |
| Driver app | API calls to any app instance (stateless) |

---

## 8. Data Archival Strategy (future)

High-growth tables that will eventually need archival:

| Table | Archival trigger | Strategy |
|-------|-----------------|----------|
| TrackingPing | > 5M rows (~3 years) | Move pings older than 6 months to `TrackingPingArchive` or S3 parquet |
| AuditLog | > 5M rows | Partition by month; detach old partitions |
| Notification | > 1M rows, status = SENT | Delete after 90 days |
| Document (files) | S3 lifecycle policy | Move to Glacier after 1 year |

Not needed at launch. Plan for Year 2.

---

## 9. Migration Plan for Schema Changes

### Phase 0 migrations (performance)

```sql
-- Migration: add_performance_indexes
-- (all indexes from Section 3.2)

-- Migration: add_sequence_table
CREATE TABLE "Sequence" (
  "prefix" TEXT NOT NULL,
  "year" INT NOT NULL,
  "lastValue" INT NOT NULL DEFAULT 0,
  PRIMARY KEY ("prefix", "year")
);
```

### Phase 1 migrations (business features)

```sql
-- Migration: add_vendor_quote
CREATE TABLE "VendorQuote" ( ... );
ALTER TABLE "Indent" ADD COLUMN "requirementId" TEXT REFERENCES "Requirement"("id");
ALTER TABLE "Indent" ADD COLUMN "quoteDeadline" TIMESTAMP;
ALTER TABLE "Requirement" ADD COLUMN "convertedToIndentId" TEXT;
ALTER TABLE "Requirement" ADD COLUMN "convertedAt" TIMESTAMP;

-- Migration: add_vehicle_verification
ALTER TABLE "Vehicle" ADD COLUMN "verificationStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "Vehicle" ADD COLUMN "verificationRemarks" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "verifiedAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN "verifiedBy" TEXT;
```

### Phase 2 migrations (driver ecosystem)

```sql
-- Migration: add_driver_ecosystem
ALTER TABLE "Driver" ADD COLUMN "driverSource" TEXT DEFAULT 'VENDOR';
ALTER TABLE "Driver" ADD COLUMN "vendorId" TEXT REFERENCES "Vendor"("id");
ALTER TABLE "Driver" ADD COLUMN "deviceType" TEXT DEFAULT 'SMARTPHONE';
ALTER TABLE "Driver" ADD COLUMN "certificationStatus" TEXT DEFAULT 'NONE';
ALTER TABLE "Driver" ADD COLUMN "shunAssistUserId" TEXT;
ALTER TABLE "Driver" ADD COLUMN "subscriptionPlanId" TEXT;

ALTER TABLE "Indent" ADD COLUMN "driverSource" TEXT;
ALTER TABLE "Indent" ADD COLUMN "poolDriverRequestId" TEXT;

ALTER TABLE "Trip" ADD COLUMN "driverSource" TEXT;
ALTER TABLE "Trip" ADD COLUMN "trackingMode" TEXT;

ALTER TABLE "TrackingPing" ADD COLUMN "source" TEXT DEFAULT 'GPS';
ALTER TABLE "TrackingPing" ADD COLUMN "accuracyMeters" DOUBLE PRECISION;

CREATE INDEX idx_driver_source ON "Driver" ("driverSource");
CREATE INDEX idx_driver_vendor_id ON "Driver" ("vendorId");
CREATE INDEX idx_driver_certification ON "Driver" ("certificationStatus")
  WHERE "certificationStatus" != 'CERTIFIED';
```

### Phase 3 migrations (RBAC)

```sql
-- Migration: add_permissions
CREATE TABLE "Permission" ( ... );
CREATE TABLE "RolePermission" ( ... );
CREATE TABLE "UserPermission" ( ... );
```

All migrations are backward-compatible (additive columns, new tables). No breaking changes to existing data.

---

## 10. Monitoring & Observability (production checklist)

| Metric | Tool | Alert threshold |
|--------|------|-----------------|
| API response time p95 | Sentry / Datadog | > 1s |
| Database connection pool usage | PgBouncer stats | > 80% |
| Redis memory usage | Redis INFO | > 200 MB |
| Postgres slow queries | `pg_stat_statements` | > 500ms |
| Disk usage | CloudWatch / provider | > 70% |
| Error rate | Sentry | > 1% of requests |
| Queue depth (notifications) | Custom metric | > 100 pending |
| App instance CPU | Provider metrics | > 70% sustained |

---

## 11. Summary

| Question | Answer |
|----------|--------|
| Connection pooling? | **Yes — PgBouncer in transaction mode.** Deploy now. |
| Caching? | **Yes — Redis for KPIs, master data, rate limits, mobile tokens.** ~1 MB at launch. |
| Stateless auth? | **Already implemented (JWT).** Ready for horizontal scaling. |
| Sharding? | **No — not for 3+ years.** Single Postgres + indexes + pooling handles 500-5,000 trips/day. |
| Performance fixes? | **10 issues identified.** Pagination + indexes + Redis cache = biggest wins. Fix in Phase 0 before adding features. |
| Schema changes? | **3 new models** (VendorQuote, Permission system), **6 model modifications** (Driver, Indent, Requirement, Vehicle, Trip, TrackingPing). All additive, backward-compatible. |
| Scale ceiling (no sharding) | **~5,000 trips/day, 500 concurrent users, 3+ years of data** on a single Postgres instance with PgBouncer and Redis. |
