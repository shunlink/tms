# TMS — Implementation Plan

**Version:** 1.1  
**Status:** Approved for execution  
**Last updated:** September 2026

> **Database:** Production schema redesign in `prisma/schema.saas.prisma` + `docs/DATABASE_SCHEMA.md` (multi-tenant SaaS, normalized indent). Application migration follows Phase 0.

---

## 1. Executive Summary

This document is the phased implementation plan for the **Shunlink TMS** — a production-grade Transport Management System for Indian 3PL aggregators. The system connects four actor types (Client, Vendor/Transporter, Driver, Admin) through a unified workflow:

```
Client Requirement → Admin Indent → Vendor Quoting → Admin Allocation → Trip Execution → POD → Invoice → Payment
```

The codebase today is a **Phase 6 Next.js monolith** with core indent/trip/billing flows implemented. This plan closes the gaps between the current application and the target production product described by the business team.

### Key business constraints (confirmed)

| Constraint | Decision |
|------------|----------|
| Requirement creation | ~0.1% via client portal; **99.9% created by admin** on phone/email |
| Vendor quoting | Portal **or** WhatsApp — **mutually exclusive**, first timestamp wins |
| Driver app | **React Native** native mobile app |
| Driver pool | Sourced from **ShunAssist** (courses + certification); independents enroll via driver app |
| Vendor drivers | Vendor registers driver on portal → same **driver app** after admin KYC approval |
| Feature phones | **Cell tower triangulation** for drivers without smartphones (no app GPS) |
| Vehicle verification | **Admin only** for now; granular RBAC for ops/finance later |
| Client payment | **Mark as paid** (no payment gateway in v1) |
| shunlink.in entry | **Redirect only** (no shared SSO) |
| WhatsApp integration | **Deferred** — design hooks now, integrate later |
| Requirement → Trip | Client requirement always becomes an **indent first**, never a trip directly |

---

## 2. Current State vs Target State

### 2.1 What exists today

| Area | Status |
|------|--------|
| Next.js 14 monolith (admin + client/vendor/driver web portals) | ✅ Done |
| PostgreSQL + Prisma (16 models) | ✅ Done |
| JWT auth via NextAuth (stateless, role-based) | ✅ Done |
| Client/Vendor/Driver onboarding + KYC document upload | ✅ Done |
| Admin onboarding approval queue | ✅ Done |
| Client portal (overview, trips, requirements, invoices, profile) | ✅ Done |
| Vendor portal (trips, POD, payments, profile) | ✅ Done |
| Driver web app (status, GPS, POD camera) | ✅ Done (web only) |
| Indent workflow + convert to trip | ✅ Done |
| Client invoicing + vendor payments + margin calc | ✅ Done |
| Notification outbox (stub/console provider) | ✅ Partial |
| Vendor auto-matching (scoring algorithm) | ✅ Done (scoring only, no quotes) |

### 2.2 Gaps to build

| # | Gap | Priority | Phase |
|---|-----|----------|-------|
| G1 | Vendor quote submission (portal + WhatsApp, first-wins) | P0 | 1 |
| G2 | Indent broadcast to vendors on creation (unassigned) | P0 | 1 |
| G3 | Admin top-5 vendor quote view + manual allocation | P0 | 1 |
| G4 | Requirement → Indent linkage (client-created reqs flow to admin) | P0 | 1 |
| G5 | Vehicle document verification workflow | P0 | 1 |
| G6 | Vendor: assign driver + vehicle before trip start | P1 | 2 |
| G7 | Driver pool + certification (ShunAssist integration) | P1 | 2 |
| G8 | React Native driver app (trips + courses + KYC gates) | P1 | 2 |
| G14 | Vendor-registered drivers → driver app accounts | P1 | 2 |
| G15 | Cell tower triangulation for feature-phone drivers | P1 | 2 |
| G16 | Independent driver subscription/course path (TBD) | P2 | 2–3 |
| G9 | Performance fixes (pagination, caching, pooling) | P0 | 1 |
| G10 | RBAC permission management (admin-configurable) | P2 | 3 |
| G11 | WhatsApp Business API (production) | P2 | 3 |
| G12 | shunlink.in redirect landing page | P2 | 3 |
| G13 | Payment gateway integration | P3 | 4 |

---

## 3. Phased Implementation

### Phase 0 — Performance & Infrastructure Foundation (Weeks 1–2)

**Goal:** Fix slow page loads and prepare for production scale before adding features.

| Task | Description | Effort |
|------|-------------|--------|
| P0.1 | Add **server-side pagination** to all list queries (`take`/`skip` + total count) | 3d |
| P0.2 | Split `queries.ts` into domain modules (`queries/trips.ts`, `queries/indents.ts`, etc.) | 2d |
| P0.3 | Deploy **PgBouncer** in transaction mode; configure Prisma `connection_limit` | 1d |
| P0.4 | Add **Redis** for dashboard KPI cache (TTL 60s), rate limiting, and session-adjacent data | 2d |
| P0.5 | Remove blanket `force-dynamic`; add `revalidate` where safe (master data lists) | 2d |
| P0.6 | Optimize dashboard: replace full-table scans with aggregated SQL / materialized counts | 2d |
| P0.7 | Add database indexes (see `SCHEMA_AND_SCALE_ANALYSIS.md`) | 1d |
| P0.8 | Fix `nextNumber()` race condition with DB-level sequence or `SELECT FOR UPDATE` | 1d |

**Exit criteria:** Page navigation < 500ms p95 on admin dashboard and list pages with 10K+ records.

---

### Phase 1 — Core Business Flow Completion (Weeks 3–6)

**Goal:** Complete the indent → quote → allocate → trip pipeline as described by the business.

#### 1.1 Requirement → Indent flow

```
Client Portal                    Admin Dashboard
     │                                │
     ▼                                ▼
 Create Requirement          Create Indent (from call/email)
     │                                │
     └──────────┬─────────────────────┘
                ▼
         Requirement record
         status: OPEN
                │
                ▼
    Admin reviews in Requirements tab
                │
                ▼
    Admin creates Indent from Requirement
    (requirementId linked, status → CONVERTED)
                │
                ▼
         Indent (unassigned)
```

**Tasks:**
- Add `requirementId` FK on `Indent` model
- Add `status` transitions on `Requirement`: `OPEN → CONVERTED → CANCELLED`
- Admin UI: "Create Indent from Requirement" button on requirement detail page
- Client portal: show requirement status (Submitted → Under Review → Indent Created)
- Block direct trip creation from requirements (admin must go through indent)

#### 1.2 Vendor quoting system

**New model: `VendorQuote`**

```
VendorQuote {
  id, indentId, vendorId, vehicleId?, quotedRate, 
  channel: PORTAL | WHATSAPP,
  status: ACTIVE | SUPERSEDED | ACCEPTED | REJECTED,
  submittedAt (timestamp, used for first-wins),
  remarks
}
```

**Business rules:**
- One quote per vendor per indent (unique constraint: `indentId + vendorId`)
- Channel is set at submission time and is immutable
- If vendor quotes on WhatsApp first → portal quote button disabled for that vendor
- If vendor quotes on portal first → WhatsApp reply ignored for that vendor
- Race condition: `submittedAt` timestamp determines winner; DB unique constraint + transaction prevents duplicates
- Quote window: configurable (default 4 hours after indent broadcast)

**Tasks:**
- Prisma migration for `VendorQuote` model
- API: `POST /api/indents/[id]/quotes` (vendor portal)
- API: `GET /api/indents/[id]/quotes` (admin — top 5 by rate or score)
- API: `POST /api/indents/[id]/allocate` (admin picks vendor from quotes)
- Vendor portal: "Available Indents" tab with quote form
- Admin indent detail: quote leaderboard (top 5), allocate button
- Stub WhatsApp inbound webhook endpoint (returns 501 until Phase 3)

#### 1.3 Indent broadcast to vendors

When admin creates an indent (status = `OPEN`, no vendor assigned):

1. System identifies eligible vendors (active, approved, matching vehicle type/region)
2. Creates notification outbox entries for each vendor (channel: WHATSAPP — stub for now)
3. Vendors see the indent in their portal "Available Indents" tab
4. Indent status remains `OPEN` until admin allocates

**Tasks:**
- `broadcastIndentToVendors(indentId)` service function
- Vendor portal: list open indents matching their fleet
- Notification template for indent broadcast (deferred WhatsApp, working in portal)

#### 1.4 Vehicle verification workflow

Add to `Vehicle` model:
```
verificationStatus: PENDING | SUBMITTED | APPROVED | REJECTED
verificationRemarks, verifiedAt, verifiedBy
```

**Tasks:**
- Vendor portal: vehicle add/edit with document upload (RC, insurance, fitness, PUC)
- Admin: vehicle verification queue (similar to onboarding queue)
- Block vehicle selection on trip/indent allocation if not `APPROVED`
- Document expiry alerts (already partially exists)

#### 1.5 Unverified client gate

Already partially implemented (`onboardingStatus`). Ensure:
- Unverified client sees **only profile page** (redirect middleware)
- Verified client sees full portal (overview, consignments, requirements, invoices)

**Exit criteria:** Full flow works end-to-end: client requirement → admin indent → vendor quotes → admin allocates → trip created.

---

### Phase 2 — Trip Execution & Driver Ecosystem (Weeks 7–10)

**Goal:** Vendor assigns resources, driver executes trip via native app, POD closes the loop.

#### 2.1 Vendor pre-trip assignment

After admin allocates indent to vendor:

```
Vendor receives assignment notification
     │
     ▼
Vendor opens assigned indent/trip
     │
     ├── Select vehicle (from approved vehicles list)
     │     └── Or add new vehicle → verification queue
     │
     ├── Assign driver
     │     ├── Register own driver (details + docs + device type)
     │     │     └── Creates driver account → driver uses mobile app after KYC
     │     └── Request driver from pool (ShunAssist certified)
     │
     ▼
Driver + Vehicle confirmed → Trip status: PENDING
```

**Vendor driver registration (important):**
- Vendor enters driver name, phone, license, documents on vendor portal
- System creates `Driver` record (`source: VENDOR`, `vendorId` linked) + `User` account (role: DRIVER)
- Driver downloads app and logs in with phone/email
- Until admin approves KYC: driver sees **profile + pending status only**
- After approval: driver sees **assigned trips** and can execute them

**Tasks:**
- Vendor portal: assignment detail page with vehicle/driver picker
- API: `PATCH /api/indents/[id]/assignment` (vendor sets vehicle + driver)
- API: `POST /api/vendors/drivers` (vendor registers a new driver)
- New vehicle creation flow with document upload + verification status
- Auto-create driver app login when vendor registers driver (SMS invite TBD)
- Capture `deviceType`: `SMARTPHONE` | `FEATURE_PHONE` on driver record

#### 2.2 ShunAssist — certification & driver pool

ShunAssist is a **separate module** with two roles in the driver ecosystem:

| Role | Who | What they see in driver app |
|------|-----|----------------------------|
| **Certification** | Independent ("newbie") drivers | Subscription plans, courses — **no trips** until certified |
| **Pool supply** | Certified drivers | Available for vendor pool requests; trip execution when assigned |

**Integration approach (adapter pattern):**

```
TMS / Driver App              ShunAssist API
 │                                │
 │  GET /drivers/available         │  (vendor requests pool driver)
 │ ──────────────────────────────► │
 │  GET /certification/{driverId}  │  (check if certified)
 │ ──────────────────────────────► │
 │  GET /plans                     │  (independent driver onboarding)
 │ ──────────────────────────────► │
 │  POST /drivers/assign           │
 │ ──────────────────────────────► │
```

**Tasks:**
- `ShunAssistAdapter` interface in `src/lib/adapters/shunassist.ts`
- Vendor portal: "Request Driver" button → shows available pool drivers
- Driver app: certification/subscription screens for `source: INDEPENDENT` drivers (UI TBD with product)
- Admin fallback: manually assign pool driver if auto-assign fails
- Store `driverSource: VENDOR | POOL | INDEPENDENT` on Driver, Indent, and Trip

#### 2.3 React Native driver mobile app

**Tech stack:** React Native (Expo managed workflow recommended for faster iteration)

**One app, three experiences** (gated by `driverSource` + `onboardingStatus` + certification):

| Experience | Who | Screens |
|------------|-----|---------|
| **KYC pending** | Vendor driver awaiting admin approval | Login, profile, document upload, "Awaiting verification" |
| **Certification path** | Independent newbie (not certified) | Login, profile, subscription plans, ShunAssist courses (TBD) |
| **Trip execution** | Approved vendor driver or certified pool driver | Trips, trip detail, GPS, POD, profile |

**Trip execution screens (approved drivers only):**

| Screen | Features |
|--------|----------|
| Login / Sign up | Phone or email; independent drivers can self-register |
| Home | Assigned trips list (empty state if none) |
| Trip Detail | Route, cargo, vendor pickup location |
| At Vendor | "I've arrived" → share GPS location |
| Start Trip | Confirm departure, begin periodic location sharing |
| In Transit | Auto GPS ping every N hours (smartphone only) |
| End Trip | "I've arrived at destination" |
| POD Upload | Camera capture → upload photo (smartphone only) |
| Profile | Driver details, documents, device type |

**Certification screens (independent drivers — TBD with product):**

| Screen | Features |
|--------|----------|
| Plans | Subscription / course catalog (from ShunAssist) |
| Course progress | Modules completed, certification status |
| Become a pool driver | CTA after certification complete |

**API requirements (new mobile-specific endpoints):**

```
POST   /api/mobile/auth/login            → JWT access + refresh tokens
POST   /api/mobile/auth/register         → independent driver sign-up
POST   /api/mobile/auth/refresh          → refresh token rotation
GET    /api/mobile/me                    → driver profile + gate status
GET    /api/mobile/trips                 → assigned trips (approved drivers only)
PATCH  /api/mobile/trips/[id]/status     → update trip status
POST   /api/mobile/trips/[id]/location   → GPS ping (source: GPS)
POST   /api/mobile/trips/[id]/pod        → multipart POD upload
GET    /api/mobile/certification         → ShunAssist course status (TBD)
GET    /api/mobile/plans                 → subscription plans (TBD)
```

**Tasks:**
- Scaffold React Native project (`tms-driver-app/`)
- Implement auth with JWT (short-lived access + refresh in Redis)
- Build gate logic: route to trips vs courses vs KYC-pending based on driver state
- Build trip execution screens (login, trip list, trip detail, POD camera)
- Build certification shell screens (placeholder until ShunAssist plans confirmed)
- Background location service (Expo Location + TaskManager) — smartphone only
- API route handlers in Next.js monolith (`/api/mobile/*`)
- App store deployment pipeline (EAS Build)

#### 2.4 Feature-phone tracking (cell triangulation)

For drivers registered with `deviceType: FEATURE_PHONE` (keypad phone, no smartphone):

- Driver **does not** use the mobile app for GPS or POD
- TMS polls location via **cell tower triangulation** using the driver's registered mobile number
- Location ingested into same `TrackingPing` table with `source: CELL` and `accuracyMeters`
- Polling interval: every 2–4 hours while trip is `IN_TRANSIT` (same as GPS mode)
- POD: vendor uploads on vendor portal on behalf of driver, or ops-assisted (workflow TBD)

**Tasks:**
- `CellTrackingAdapter` interface in `src/lib/adapters/cell-tracking.ts`
- Background worker/cron: `pollFeaturePhoneLocations()` for active trips with feature-phone drivers
- Admin/vendor UI: indicate tracking mode (GPS vs Cell) on trip detail
- Evaluate LBS providers (operator API, third-party telco-location service) — selection TBD
- Store `accuracyMeters` on `TrackingPing` for ops visibility

#### 2.5 Trip lifecycle (driver side)

**Smartphone driver (app):**
```
Driver arrives at vendor → share GPS ("at pickup")
     ▼
Start trip → DISPATCHED / IN_TRANSIT
     ▼
Auto GPS ping every 2-4 hours
     ▼
Arrive at destination → DELIVERED
     ▼
Upload POD photo in app → POD_RECEIVED
```

**Feature-phone driver (no app GPS):**
```
Trip assigned → driver phone number linked to trip
     ▼
System polls cell triangulation every 2-4 hours → IN_TRANSIT
     ▼
Vendor/ops marks delivered + uploads POD → POD_RECEIVED
```

**Both paths then:**
```
POD_RECEIVED → invoice created → mark PAID → CLOSED
```

**Exit criteria:** Vendor registers driver → driver approved → executes trip (smartphone or feature-phone path), POD uploaded, invoice generated. Independent driver can sign up and see certification path (even if ShunAssist integration is stubbed).

---

### Phase 3 — Admin RBAC, Integrations & Polish (Weeks 11–14)

**Goal:** Production hardening, permission management, external integrations.

#### 3.1 Granular RBAC

Current: 6 fixed roles (`ADMIN`, `OPERATIONS`, `ACCOUNTS`, `CLIENT`, `VENDOR`, `DRIVER`).

Target: Admin-configurable permissions per role, team, or individual user.

**New models:**

```
Permission {
  id, key (e.g. "indent.approve", "vehicle.verify", "invoice.create")
  label, module
}

RolePermission {
  roleId, permissionId
}

UserPermission {
  userId, permissionId, granted (boolean override)
}
```

**Admin UI:** Settings → Permissions → matrix view (roles × permissions) + per-user overrides.

**Default permission sets:**

| Permission | ADMIN | OPS | ACCOUNTS |
|------------|-------|-----|----------|
| indent.create | ✅ | ✅ | ❌ |
| indent.approve | ✅ | ❌ | ❌ |
| indent.allocate | ✅ | ✅ | ❌ |
| vehicle.verify | ✅ | ❌ | ❌ |
| onboarding.approve | ✅ | ✅ | ❌ |
| invoice.create | ✅ | ❌ | ✅ |
| invoice.markPaid | ✅ | ❌ | ✅ |
| payment.approve | ✅ | ❌ | ✅ |
| reports.view | ✅ | ✅ | ✅ |
| users.manage | ✅ | ❌ | ❌ |
| permissions.manage | ✅ | ❌ | ❌ |

#### 3.2 WhatsApp Business API integration

Deferred from Phase 1; implement when credentials are ready.

**Integration points:**
- Indent broadcast to vendors
- Vendor quote via WhatsApp (inbound webhook → `VendorQuote` with `channel: WHATSAPP`)
- Trip status updates to client/vendor
- Assignment notification to vendor

**Architecture:** Outbox pattern (already exists) → worker process → Meta Cloud API.

#### 3.3 shunlink.in redirect

- Add landing route `/welcome` or detect `?ref=shunlink` query param
- Redirect to client onboarding (`/onboard/client`) or login
- No shared auth — separate user registration in TMS

#### 3.4 S3 document storage

- Implement S3 adapter (currently stubbed)
- Migrate local uploads to S3 for production
- Pre-signed URLs for document access

**Exit criteria:** RBAC working, WhatsApp sending (at least indent broadcast), S3 storage live, shunlink.in redirect active.

---

### Phase 4 — Scale & Intelligence (Weeks 15–20)

**Goal:** Optimize for full production scale, add data-driven features.

| Task | Description |
|------|-------------|
| Read replica for reports/analytics queries | Offload heavy reads |
| Payment gateway (Razorpay/PayU) | Client self-service payment |
| Lane pricing intelligence | Historical rate benchmarks |
| Vendor scorecard automation | On-time %, rate competitiveness |
| CI/CD pipeline | GitHub Actions → Docker → deploy |
| Monitoring & alerting | Sentry, uptime checks, DB slow query log |
| Load testing | k6/Artillery — validate 1000 trips/day capacity |

---

## 4. Team & Effort Estimate

| Phase | Duration | Team | Deliverable |
|-------|----------|------|-------------|
| Phase 0 | 2 weeks | 2 backend + 1 frontend | Fast, stable base |
| Phase 1 | 4 weeks | 2 backend + 2 frontend | Quote + indent flow complete |
| Phase 2 | 4 weeks | 1 backend + 1 mobile + 1 frontend | Driver app + trip execution |
| Phase 3 | 4 weeks | 2 full-stack | RBAC + integrations |
| Phase 4 | 6 weeks | 2 full-stack + 1 DevOps | Production scale |

**Total: ~20 weeks to full production** with a team of 3–4 engineers.

---

## 5. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| ShunAssist API not ready | Blocks pool + certification screens | Build adapter with mock; vendor drivers still work; stub course UI |
| LBS/triangulation provider not selected | Feature-phone tracking unavailable | Default to vendor-reported location + manual ops updates |
| Independent driver plans undefined | Certification screens incomplete | Ship shell UI; gate trip access on `certificationStatus` flag |
| WhatsApp API approval delay | No automated vendor notifications | Portal-based indent listing works without WhatsApp |
| React Native learning curve | Driver app delayed | Start with Expo; reuse API patterns from driver web app |
| Performance regression with new features | Slow pages return | Phase 0 fixes first; pagination mandatory for all new lists |
| Quote race conditions | Duplicate quotes, wrong vendor selected | DB unique constraint + `submittedAt` first-wins + transaction isolation |
| Document storage at scale | Disk full / slow uploads | S3 migration in Phase 3; enforce file size limits now |

---

## 6. Success Metrics

| Metric | Target (6 months post-launch) |
|--------|-------------------------------|
| Page load p95 | < 500ms |
| Indent-to-allocation time | < 4 hours (quote window) |
| POD upload rate (within 24h of delivery) | > 90% |
| System uptime | 99.5% |
| Concurrent users supported | 100+ without degradation |
| Trips per day | 500+ without sharding |

---

## 7. Dependencies & External Systems

```
┌─────────────┐     redirect      ┌──────────────┐
│ shunlink.in │ ────────────────► │  TMS Web App │
└─────────────┘                   └──────┬───────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              ┌─────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
              │ PostgreSQL │      │    Redis     │     │  S3 Storage │
              │ + PgBouncer│      │   (cache)    │     │ (documents) │
              └───────────┘      └─────────────┘     └─────────────┘
                    │
              ┌─────▼─────┐      ┌─────────────┐     ┌─────────────┐
              │ ShunAssist │      │  WhatsApp   │     │ React Native│
              │ (courses + │      │  (deferred) │     │ Driver App  │
              │ driver pool)│     └─────────────┘     └─────────────┘
              └───────────┘
                    │
              ┌─────▼─────┐
              │ LBS / Cell │
              │ Triangulation│
              │ (feature phones)│
              └───────────┘
```

---

## 8. Next Steps (Immediate Actions)

1. **This week:** Start Phase 0 performance fixes (pagination + PgBouncer + Redis)
2. **This week:** Create Prisma migration for `VendorQuote` model and `Indent.requirementId`
3. **Next week:** Build vendor quote portal UI + admin quote leaderboard
4. **Parallel:** Scaffold React Native driver app repo
5. **Ongoing:** Keep `ARCHITECTURE_AND_USER_FLOW.md` and `SCHEMA_AND_SCALE_ANALYSIS.md` updated as decisions are made
