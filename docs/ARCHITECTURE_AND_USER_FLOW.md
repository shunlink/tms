# TMS — Architecture & User Flow

**Version:** 2.0  
**Status:** Living document  
**Last updated:** October 2026

**See also:** [DEVELOPER_CODEMAP.md](./DEVELOPER_CODEMAP.md) (routes, APIs, services, and where to edit code), [ARCHITECTURE.md](./ARCHITECTURE.md) (POD, advances, email workers), [bidding-integration.md](./bidding-integration.md), [PAYMENT_PROCESSING.md](./PAYMENT_PROCESSING.md).

---

## 1. System Architecture Overview

### 1.1 High-level architecture

```mermaid
graph TB
    subgraph "Entry Points (one Next.js deployable)"
        WELCOME["/welcome · /login · /signup"]
        DASH["(dashboard)/<br/>Staff: Ops · Sales · Finance"]
        PC["portal/client/"]
        PV["portal/vendor/"]
        DRV_WEB["driver/<br/>(web + OTP)"]
        BIDDING["External Bidding app<br/>(integration APIs)"]
    end

    subgraph "Application Layer"
        NEXTJS["Next.js 14 App Router<br/>RSC pages + API routes"]
        MW["middleware.ts<br/>JWT + role routing + portal API allowlist"]
        RSC["Server Components<br/>queries.ts reads"]
        API["route.ts handlers<br/>services + Prisma writes"]
    end

    subgraph "Data Layer"
        PGB["PgBouncer<br/>(connection pool)"]
        PG["PostgreSQL 16<br/>(primary)"]
        REDIS["Redis<br/>(cache + rate limit)"]
        S3["S3 / Object Storage<br/>(documents)"]
    end

    subgraph "External Services (deferred)"
        WA["WhatsApp Business API"]
        SA["ShunAssist<br/>(courses + driver pool)"]
        LBS["LBS / Cell Triangulation<br/>(feature phone tracking)"]
        MAPS["Maps / Geocoding"]
    end

    WELCOME --> MW
    DASH --> MW
    PC --> MW
    PV --> MW
    DRV_WEB --> MW
    BIDDING -->|server secret| API

    MW --> RSC
    MW --> API
    RSC --> PGB
    API --> PGB
    PGB --> PG
    RSC --> REDIS
    API --> REDIS
    API --> S3

    API -.->|future| WA
    API -.->|future| SA
    API -.->|future| LBS
    API --> MAPS
```

### 1.2 Request flow (stateless auth)

```mermaid
sequenceDiagram
    participant U as User (Browser/App)
    participant MW as Middleware
    participant RSC as Server Component / API
    participant JWT as JWT Token (client-side cookie)
    participant DB as PostgreSQL

    U->>MW: HTTPS request + session cookie
    MW->>JWT: Decode & validate JWT
    alt Invalid / expired
        MW-->>U: Redirect to /login
    else Valid
        MW->>MW: Check role + route permissions
        alt Forbidden route
            MW-->>U: 403 / redirect to role home
        else Allowed
            MW->>RSC: Forward request
            RSC->>DB: Prisma query (via PgBouncer)
            DB-->>RSC: Data
            RSC-->>U: HTML / JSON response
        end
    end
```

**Key design decision:** JWT tokens are stored in HTTP-only cookies on the client, not in server memory. Any app instance can validate any request — enabling horizontal scaling behind a load balancer without sticky sessions.

### 1.3 Deployment architecture

```mermaid
graph TB
    subgraph "CDN / Edge"
        CF["Cloudflare / CDN<br/>(static assets)"]
    end

    subgraph "Load Balancer"
        LB["Nginx / ALB"]
    end

    subgraph "App Tier (stateless, horizontally scalable)"
        APP1["Next.js Instance 1"]
        APP2["Next.js Instance 2"]
        APPN["Next.js Instance N"]
    end

    subgraph "Cache Tier"
        REDIS["Redis Cluster<br/>sessions · KPIs · rate limits"]
    end

    subgraph "Database Tier"
        PGB["PgBouncer<br/>(transaction pooling)"]
        PG_PRIMARY["PostgreSQL Primary"]
        PG_REPLICA["PostgreSQL Read Replica<br/>(Phase 4 — reports only)"]
    end

    subgraph "Storage"
        S3["S3 Bucket<br/>(documents, POD photos)"]
    end

    CF --> LB
    LB --> APP1
    LB --> APP2
    LB --> APPN
    APP1 --> REDIS
    APP2 --> REDIS
    APPN --> REDIS
    APP1 --> PGB
    APP2 --> PGB
    APPN --> PGB
    PGB --> PG_PRIMARY
    PG_PRIMARY --> PG_REPLICA
    APP1 --> S3
```

---

## 2. User Flows

### 2.0 Authentication and entry routes

All authenticated surfaces share **NextAuth JWT** (`src/lib/auth.ts`). **Middleware** (`src/middleware.ts`) sends each role to the correct app shell and restricts portal API calls.

| Step | Route | Notes |
|------|--------|--------|
| Choose portal | `/welcome` | Links to client/vendor signup or login |
| Register | `/signup/client`, `/signup/vendor` | Creates user + party stub |
| Login | `/login`, `/login/client`, `/login/vendor`, `/login/employee`, `/login/driver` | Employee = internal dashboard |
| KYC wizard | `/onboard/client`, `/onboard/vendor` | Until docs submitted (`portal-access.ts`) |
| After approval | `/portal/client`, `/portal/vendor` | Full nav in portal shells |

**Onboarding statuses:** `PENDING` → must complete `/onboard/*`; `SUBMITTED` / `REJECTED` → **profile only** (`/portal/*/profile`); `APPROVED` → overview, trips, requirements, invoices (client) or indents/trips/payments (vendor).

**Super Admin support:** `/superadmin/portal-access` can start a time-limited **portal access** session to view client/vendor UI as that party (banner shown; sensitive actions blocked).

### 2.1 Client journey

```mermaid
flowchart TD
    A["/welcome or /login/client"] --> B{"Account?"}
    B -->|No| C["/signup/client"]
    B -->|Yes| D["Login"]
    C --> E["/onboard/client<br/>company + documents"]
    E --> F["POST /api/portal/onboarding<br/>status: SUBMITTED"]
    F --> G{"Admin review<br/>/onboarding queue"}
    G -->|Rejected| H["/portal/client/profile only"]
    G -->|Approved| I["/portal/client full access"]

    D --> J{"onboardingStatus"}
    J -->|PENDING| E
    J -->|SUBMITTED or REJECTED| H
    J -->|APPROVED| I

    I --> K["Overview /portal/client"]
    I --> L["Shipments /portal/client/trips"]
    I --> M["Requirements /portal/client/requirements"]
    I --> N["Invoices /portal/client/invoices"]

    M --> O["POST /api/requirements"]
    O --> P["Staff converts to indent<br/>(dashboard)"]
    P --> L
    L --> Q["Trip execution + POD"]
    Q --> R["Finance: invoice + client payment"]
    R --> S["Trip closed"]
```

**Note:** Most indents are still created by **staff** from phone/email; client requirements are the exception path.

### 2.2 Internal staff journey (dashboard)

Staff use **`/login/employee`** (or the employee tab on `/login`) and land on **`/`** — the `(dashboard)` app shell. Navigation is **permission-based** (`nav-permissions.ts`) and can be **team-scoped** (Sales, Operations, Finance).

```mermaid
flowchart TD
    A["/login/employee"] --> B["Dashboard /"]
    B --> C["/onboarding — KYC queue"]
    B --> D["/requirements + /indents"]
    B --> E["/placement — vehicle at pickup"]
    B --> F["/trips — execution + tracking"]

    D --> G["Create / edit indent"]
    G --> H{"Allocation mode"}
    H -->|Manual quotes| I["Vendors quote via portal or WhatsApp<br/>first-wins per vendor"]
    H -->|Bidding award| J["/api/integration/bidding/award-handoff"]
    I --> K["POST allocate vendor"]
    J --> K
    K --> E
    E --> L["Vendor assigns vehicle + driver<br/>portal or staff APIs"]
    L --> F

    F --> M["Advance request / approval<br/>trip-advance.service"]
    M --> N["IN_TRANSIT when advance rules pass"]
    N --> O["POD upload → /pods queue"]
    O --> P["Finance: invoices, payables,<br/>client-payments, outbound payments"]
    P --> Q["Accounting journals / subledgers<br/>optional GL posting"]
    Q --> R["Trip CLOSED"]

    B --> S["/bidding-management<br/>ADMIN / SUPER_ADMIN"]
    S --> T["Proxy to external Bidding UI"]
```

**Roles:** `SUPER_ADMIN`, `ADMIN`, `SALES`, `OPERATIONS`, `FINANCE`, `VENDOR_TEAM` — internal roles cannot browse `/portal/*` (middleware redirects to `/`).

### 2.3 Vendor (transporter) journey

```mermaid
flowchart TD
    A["/welcome or /login/vendor"] --> B{"Account?"}
    B -->|No| C["/signup/vendor"]
    B -->|Yes| D["Login"]
    C --> E["/onboard/vendor"]
    E --> F["Submit KYC → SUBMITTED"]
    F --> G{"Admin /onboarding"}
    G -->|REJECTED| H["/portal/vendor/profile only"]
    G -->|APPROVED| I["Full vendor portal"]

    D --> J{"onboardingStatus"}
    J -->|PENDING| E
    J -->|SUBMITTED or REJECTED| H
    J -->|APPROVED| I

    I --> K["/portal/vendor/indents<br/>open indents + quote"]
    K --> L["POST /api/indents/:id/quotes"]
    K --> M["WhatsApp quote webhook<br/>first-wins vs portal"]

    I --> N["/portal/vendor/trips<br/>assigned trips"]
    I --> O["/portal/vendor/assignments/:id<br/>placement detail"]
    N --> P["POD / advance / tracking APIs"]
    I --> Q["/portal/vendor/payments<br/>summary + Bidding mirror trips"]

    P --> R["Finance pays vendor<br/>dashboard /payments"]
```

Vendors linked to **Bidding** also receive trips via integration (`bidding-integration.service.ts`); payment summary can be read from `/api/integration/bidding/vendor/*`.

### 2.4 Driver types & onboarding paths

Every driver who operates trips must exist in the TMS driver registry. There are **three driver sources**:

| Source | How they enter the system | App access after approval |
|--------|---------------------------|---------------------------|
| **Vendor driver** | Vendor registers them on the vendor portal (details + docs) | Trip execution screens |
| **Pool driver** | Assigned from ShunAssist certified pool (vendor requests, admin assigns) | Trip execution screens |
| **Independent (newbie)** | Self-registers on the driver app (not linked to a vendor) | Subscription / course screens only (until certified) |

```mermaid
flowchart TD
    subgraph "Entry Paths"
        V1["Vendor registers driver<br/>on vendor portal"]
        V2["Admin assigns pool driver<br/>from ShunAssist"]
        V3["Independent driver<br/>self-registers on app"]
    end

    V1 --> D1["Driver record<br/>source: VENDOR<br/>vendorId linked"]
    V2 --> D2["Driver record<br/>source: POOL<br/>ShunAssist certified"]
    V3 --> D3["Driver record<br/>source: INDEPENDENT"]

    D1 --> KYC1["Admin reviews KYC docs"]
    D2 --> KYC2["Already certified via ShunAssist"]
    D3 --> KYC3["No trip access yet"]

    KYC1 -->|Approved| APP1["Approved vendor driver"]
    KYC1 -->|Pending/Rejected| GATE1["App: profile + status only"]
    KYC2 --> APP2["Approved pool driver"]
    KYC3 --> APP3["App: subscription plans<br/>+ courses (ShunAssist)<br/>TBD — build driver pool"]

    APP3 -->|Completes course| CERT["Certification earned"]
    CERT --> POOL["Eligible for pool assignments<br/>+ can accept trips"]
```

### 2.5 Driver experience (web today; mobile planned)

**Production today:** drivers sign in at **`/login/driver`** (DL number + OTP) and use the **web** shell at **`/driver`** — current indent, tracking form, profile. APIs are allowlisted in middleware (`/api/drivers/me/current-indent`, tracking, POD on indent/trip).

**Planned:** React Native app with the same role gates; pool/certification flows below still apply for independent drivers.

The driver home depends on **source + approval/certification status**:

```mermaid
flowchart TD
    A["Driver opens app"] --> B["Login / Sign up"]
    B --> C{"Driver source<br/>+ status?"}

    C -->|VENDOR driver<br/>not approved| D["Profile + KYC status<br/>'Awaiting verification'"]
    C -->|INDEPENDENT<br/>not certified| E["Subscription & courses<br/>(ShunAssist integration TBD)"]
    C -->|VENDOR or POOL<br/>approved/certified| F["Home — assigned trips"]

    E --> E1["Browse plans / enroll in course"]
    E1 --> E2["Complete certification"]
    E2 --> F

    F --> G{"Device type?"}
    G -->|Smartphone| H["Full trip flow<br/>GPS + camera POD"]
    G -->|Feature phone (keypad)| I["Limited trip flow<br/>USSD/SMS or ops-assisted<br/>cell triangulation tracking"]

    H --> J["Select trip → arrive at pickup → start trip"]
    J --> K["GPS pings every 2-4 hours"]
    K --> L["Arrive at destination → upload POD photo"]
    L --> M["Trip → POD_RECEIVED"]

    I --> N["Trip assigned — tracking via<br/>cell tower triangulation"]
    N --> O["Periodic location from<br/>mobile network (no app GPS)"]
    O --> P["POD via vendor/ops upload<br/>or SMS photo link (TBD)"]
    P --> M
```

**App screen matrix:**

| Screen | Vendor driver (approved) | Pool driver | Independent (uncertified) | Any (pending KYC) |
|--------|--------------------------|-------------|---------------------------|-------------------|
| Login / Sign up | ✅ | ✅ | ✅ | ✅ |
| Profile & documents | ✅ | ✅ | ✅ | ✅ |
| Assigned trips | ✅ | ✅ | ❌ | ❌ |
| Trip execution (start/end) | ✅ | ✅ | ❌ | ❌ |
| GPS location sharing | ✅ (smartphone) | ✅ | ❌ | ❌ |
| POD camera upload | ✅ (smartphone) | ✅ | ❌ | ❌ |
| Subscription plans | ❌ | ❌ | ✅ (TBD) | ❌ |
| Courses / certification | ❌ | Optional refresh | ✅ (ShunAssist) | ❌ |
| KYC pending message | — | — | — | ✅ |

### 2.6 Location tracking — dual mode

```mermaid
flowchart LR
    subgraph "Smartphone driver"
        APP["Driver App<br/>(React Native)"]
        GPS["Device GPS<br/>(Expo Location)"]
        API1["POST /api/mobile/trips/id/location"]
        APP --> GPS --> API1
    end

    subgraph "Feature phone driver (keypad)"
        PHONE["Driver mobile number<br/>(registered on trip)"]
        TELCO["Cell tower triangulation<br/>(operator / LBS API)"]
        WORKER["Location polling worker<br/>(every 2-4 hours)"]
        API2["POST internal tracking ingest"]
        PHONE --> TELCO --> WORKER --> API2
    end

    API1 --> DB["TrackingPing<br/>source: GPS"]
    API2 --> DB2["TrackingPing<br/>source: CELL"]
```

| Mode | Device | How location is captured | POD upload |
|------|--------|--------------------------|------------|
| **GPS (primary)** | Smartphone with driver app | App background GPS → `TrackingPing` | In-app camera |
| **Cell triangulation (fallback)** | Keypad / feature phone, no smartphone | Mobile number + LBS/triangulation API on schedule | Vendor uploads on behalf, or ops-assisted (TBD) |

**Note:** Cell triangulation accuracy is lower than GPS (typically 500m–2km vs 5–20m). Acceptable for corridor-level tracking on long-haul lanes; document this limitation for ops team.

### 2.7 End-to-end order lifecycle

```mermaid
stateDiagram-v2
    [*] --> RequirementOpen: Client creates requirement (0.1%)
    [*] --> IndentOpen: Admin creates indent (99.9%)
    RequirementOpen --> IndentOpen: Admin converts to indent

    IndentOpen --> Quoting: Broadcast to vendors
    Quoting --> VendorAllocated: Admin picks from top 5 quotes

    VendorAllocated --> ResourcesAssigned: Vendor assigns vehicle + driver
    ResourcesAssigned --> TripPending: Trip created

    TripPending --> Dispatched: Driver starts trip at vendor location
    Dispatched --> InTransit: En route (auto GPS pings)
    InTransit --> Delivered: Driver arrives at destination
    Delivered --> PodReceived: Driver uploads POD photo

    PodReceived --> Invoiced: Admin/accounts creates invoice
    Invoiced --> Paid: Accounts marks as paid
    Paid --> Closed: Trip closed
    Closed --> [*]

    Quoting --> Cancelled: No quotes / client cancels
    Cancelled --> [*]
```

---

## 3. Data Flow Architecture

### 3.1 Read path (server components)

```mermaid
flowchart LR
    PAGE["Page (RSC)"] --> CACHE{"Redis cache<br/>hit?"}
    CACHE -->|Hit| RESP["Return cached data"]
    CACHE -->|Miss| QUERY["queries.ts"]
    QUERY --> SVC["services/*.ts"]
    SVC --> PGB["PgBouncer"]
    PGB --> PG["PostgreSQL"]
    PG --> SVC
    SVC --> STORE["Store in Redis<br/>(TTL 30-60s)"]
    STORE --> RESP
```

### 3.2 Write path (API routes)

```mermaid
flowchart LR
    FORM["Client Component<br/>(fetch to API)"] --> API["API Route Handler"]
    API --> AUTH["requireAuth() + authorize(permission)"]
    AUTH --> VALIDATE["Zod validation"]
    VALIDATE --> SVC["services/*.ts"]
    SVC --> TX["Prisma transaction"]
    TX --> PG["PostgreSQL"]
    TX --> AUDIT["Audit log entry"]
    TX --> NOTIFY["Notification outbox<br/>(if status change)"]
    TX --> CACHE_INV["Invalidate Redis cache"]
    API --> RESP["JSON response"]
```

### 3.3 Vendor quote flow (first-wins)

```mermaid
sequenceDiagram
    participant A as Admin
    participant SYS as TMS System
    participant DB as PostgreSQL
    participant VP as Vendor Portal
    participant VW as Vendor (WhatsApp)
    participant V as Vendor

    A->>SYS: Create indent (unassigned)
    SYS->>DB: Insert indent (status: OPEN)
    SYS->>V: Broadcast indent (portal listing)

    par Vendor quotes via portal
        V->>VP: Submit quote (rate: ₹45,000)
        VP->>DB: INSERT VendorQuote<br/>(channel: PORTAL, submittedAt: T1)
        DB-->>VP: Success (first quote for this vendor)
    and Vendor tries WhatsApp
        V->>VW: Reply with quote (rate: ₹44,000)
        VW->>DB: INSERT VendorQuote<br/>(channel: WHATSAPP, submittedAt: T2)
        alt T2 > T1 (portal was first)
            DB-->>VW: Rejected — portal quote already exists
        end
    end

    A->>SYS: View top 5 quotes
    SYS->>DB: SELECT quotes ORDER BY quotedRate LIMIT 5
    DB-->>SYS: Quote leaderboard
    A->>SYS: Allocate to vendor X
    SYS->>DB: UPDATE indent SET vendorId=X, status=ALLOCATED
    SYS->>V: Assignment notification
```

---

## 4. Component Architecture (Application Internals)

```mermaid
graph TB
    subgraph "src/app/"
        DASH["(dashboard)/ — staff UI"]
        PC["portal/client/"]
        PV["portal/vendor/"]
        DRV["driver/"]
        ONB["onboard/ + login/ + signup/ + welcome/"]
        API_R["api/**/route.ts"]
        SA["superadmin/"]
    end

    subgraph "src/lib/"
        AUTH_L["auth.ts · auth-context.ts"]
        API_LIB["api.ts — requireAuth, authorize"]
        QUERIES["queries.ts — RSC reads"]
        SVC["services/*.ts — domain writes"]
        ACCT["accounting/ · payments/"]
        INT["integration/bidding · integrations/"]
        VALID["validation.ts"]
        AUDIT_L["audit.ts"]
        PERM["services/permission.service.ts"]
        NAV["nav-permissions.ts"]
    end

    subgraph "src/components/"
        UI["ui/"]
        FORMS["forms/"]
        PORTAL["portal/ · onboarding/"]
        SHELL["app-shell · *-portal-shell"]
    end

    DASH --> QUERIES
    PC --> QUERIES
    PV --> QUERIES
    DRV --> QUERIES
    API_R --> API_LIB
    API_LIB --> SVC
    API_LIB --> VALID
    SVC --> AUDIT_L
    QUERIES --> SVC
    DASH --> SHELL
    PC --> SHELL
    PV --> SHELL
    FORMS --> API_R
```

Detailed file index: **[DEVELOPER_CODEMAP.md](./DEVELOPER_CODEMAP.md)**.

---

## 5. Authentication & Authorization Model

### 5.1 Roles and RBAC

```mermaid
graph TD
    SA["SUPER_ADMIN<br/>all permissions + portal access tool"]
    ADMIN["ADMIN<br/>permission matrix (no /permissions UI)"]
    OPS["OPERATIONS / SALES / FINANCE / VENDOR_TEAM<br/>team-scoped sidebar"]
    CLIENT["CLIENT — portal"]
    VENDOR["VENDOR — portal"]
    DRIVER["DRIVER — /driver web"]

    SA --> ADMIN
    ADMIN --> OPS
    OPS --> PERM["Permission keys<br/>permission.service + nav-permissions"]
```

**Internal** users are authorized per **permission key** on each API (`authorize(auth, "indent.allocate")`). **Portal** users are constrained by middleware route prefixes and a small **API allowlist** (e.g. client may `POST /api/requirements`).

### 5.2 Onboarding gate

```mermaid
flowchart LR
    SIGNUP["Signup /api/auth/signup"] --> ONB["/onboard/* wizard"]
    ONB --> PENDING["PENDING — editing allowed"]
    PENDING --> SUBMIT["POST /api/portal/onboarding"]
    SUBMIT --> SUBMITTED["SUBMITTED — profile-only portal"]
    SUBMITTED --> REVIEW["Staff /onboarding review"]
    REVIEW -->|Approve| APPROVED["APPROVED — full portal"]
    REVIEW -->|Reject| REJECTED["REJECTED — profile-only + remarks"]
    REJECTED --> ONB
```

Applies to **Client** and **Vendor** parties (`onboarding.service.ts`). **Vehicle** and **driver** KYC are reviewed from the dashboard onboarding queue. Independent drivers still use the **certification gate** (ShunAssist) when that path is enabled.

---

## 6. Integration Architecture

### 6.1 ShunAssist — driver pool & certification (adapter pattern)

ShunAssist serves **two purposes** in the driver ecosystem:

1. **Certification** — independent ("newbie") drivers complete courses on ShunAssist to join the certified pool
2. **Pool supply** — vendors request certified drivers; TMS assigns from the pool

```mermaid
graph LR
    TMS["TMS Application"]
    DRV_APP["Driver App<br/>(React Native)"]
    ADAPTER["ShunAssistAdapter<br/>(interface)"]
    MOCK["MockAdapter<br/>(dev/test)"]
    LIVE["HttpAdapter<br/>(production)"]
    SA["ShunAssist<br/>(courses + pool API)"]

    DRV_APP -->|independent driver<br/>courses & plans| SA
    TMS --> ADAPTER
    ADAPTER --> MOCK
    ADAPTER --> LIVE
    LIVE --> SA
```

**Contract (planned):**
- `listAvailableDrivers(location, vehicleType)` → certified drivers near pickup
- `assignDriver(driverId, indentId)` → reserve driver for trip
- `releaseDriver(driverId)` → return driver to pool after trip
- `getCertificationStatus(driverId)` → course completion / pool eligibility
- `listSubscriptionPlans()` → plans shown to uncertified independent drivers (TBD)
- `enrollDriver(driverId, planId)` → start certification path (TBD)

### 6.2 Cell tower triangulation (feature phone tracking)

For drivers on **keypad/feature phones** without the smartphone app:

```mermaid
sequenceDiagram
    participant OPS as TMS / Worker
    participant LBS as LBS / Triangulation Provider
    participant TEL as Mobile Operator
    participant DB as TrackingPing

    Note over OPS: Trip IN_TRANSIT, driver has feature phone
    OPS->>LBS: Request location for +91XXXXXXXXXX
    LBS->>TEL: Cell tower lookup
    TEL-->>LBS: Tower IDs → lat/lng (approx)
    LBS-->>OPS: Coordinates + accuracy radius
    OPS->>DB: INSERT TrackingPing<br/>(source: CELL, accuracyMeters)
```

**Provider options (India):** operator LBS APIs, third-party telco-location services, or SIM-based tracking partners. Selection TBD in Phase 2.

**Requirements:**
- Driver phone number must be registered on the trip and match operator records
- Polling interval: same as GPS mode (every 2–4 hours while `IN_TRANSIT`)
- Store `accuracyMeters` on each ping so ops can distinguish GPS vs cell data
- POD for feature-phone drivers: vendor portal upload or ops-assisted capture (workflow TBD)

### 6.3 WhatsApp integration (deferred — adapter ready)

```mermaid
graph LR
    TMS["TMS Application"]
    OUTBOX["Notification Outbox<br/>(DB table)"]
    WORKER["Outbox Worker<br/>(cron / queue)"]
    WA_ADAPTER["WhatsAppAdapter"]
    META["Meta Cloud API"]

    TMS -->|status change| OUTBOX
    OUTBOX --> WORKER
    WORKER --> WA_ADAPTER
    WA_ADAPTER --> META

    META -->|inbound webhook| TMS
    TMS -->|parse quote reply| DB["VendorQuote<br/>(channel: WHATSAPP)"]
```

### 6.4 Document storage

```mermaid
flowchart LR
    UPLOAD["File upload<br/>(form/camera)"] --> API["API handler"]
    API --> DRIVER{"STORAGE_DRIVER?"}
    DRIVER -->|local| LOCAL["public/uploads/"]
    DRIVER -->|s3| S3["AWS S3 / compatible"]
    API --> DB["Document record<br/>(url, type, entity)"]
    SERVE["GET /files/..."] --> AUTH_CHECK["Auth check"]
    AUTH_CHECK --> DRIVER
```

---

## 7. Security Architecture

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS everywhere (TLS 1.2+) |
| Authentication | NextAuth JWT (HTTP-only cookie) + bcrypt passwords |
| Mobile auth | Short-lived access token (15min) + refresh token (7d) in Redis |
| Authorization | Middleware role routing + portal API allowlist + `authorize()` permission keys |
| RBAC | `permission.service.ts` + team-filtered sidebar (`nav-permissions.ts`) |
| Rate limiting | Redis-backed (login: 8 attempts / 5 min) |
| Input validation | Zod schemas on all API inputs |
| File uploads | Type/size limits, authenticated access only |
| Audit | All mutations logged to AuditLog table |
| Headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy (next.config.js) |

---

## 8. Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| App architecture | Next.js monolith | Single deployable unit; RSC for fast reads; sufficient for 500+ trips/day |
| Database | PostgreSQL 16 + PgBouncer | ACID for financial data; connection pooling for scale |
| Cache | Redis | Dashboard KPIs, rate limits, mobile refresh tokens |
| Auth | JWT (stateless) | Horizontal scaling without sticky sessions |
| Driver app | React Native (Expo) | Native camera/GPS; cross-platform; faster than Flutter for JS team |
| File storage | S3 (production) | Scalable, durable; local for dev |
| ORM | Prisma | Type-safe; migration management; team familiarity |
| Notifications | Outbox pattern | Reliable delivery; decouple from request cycle |
| Sharding | Not now | Single Postgres + pooling handles target scale (see SCHEMA doc) |
