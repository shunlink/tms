# TMS — Architecture & User Flow

**Version:** 1.0  
**Status:** Living document  
**Last updated:** September 2026

---

## 1. System Architecture Overview

### 1.1 High-level architecture

```mermaid
graph TB
    subgraph "Entry Points"
        SHUNLINK["shunlink.in<br/>(marketing site)"]
        ADMIN_WEB["Admin Dashboard<br/>(Next.js Web)"]
        CLIENT_WEB["Client Portal<br/>(Next.js Web)"]
        VENDOR_WEB["Vendor Portal<br/>(Next.js Web)"]
        DRIVER_APP["Driver App<br/>(React Native)"]
    end

    subgraph "Application Layer"
        NEXTJS["Next.js 14 Monolith<br/>App Router + API Routes"]
        MW["Middleware<br/>JWT Auth + RBAC"]
        RSC["React Server Components<br/>(reads)"]
        API["Route Handlers<br/>(writes)"]
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

    SHUNLINK -->|redirect| CLIENT_WEB
    ADMIN_WEB --> MW
    CLIENT_WEB --> MW
    VENDOR_WEB --> MW
    DRIVER_APP -->|REST API| API

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

    subgraph "Mobile"
        RN["React Native Driver App<br/>(Expo EAS)"]
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
    RN --> LB
```

---

## 2. User Flows

### 2.1 Client journey

```mermaid
flowchart TD
    A["User visits shunlink.in"] -->|redirect| B["TMS Client Portal"]
    B --> C{"Has account?"}
    C -->|No| D["Sign Up / Onboarding"]
    C -->|Yes| E["Login"]

    D --> F["Fill company details<br/>GST, PAN, address, bank"]
    F --> G["Upload documents<br/>GST cert, PAN card, etc."]
    G --> H["Submit for verification"]
    H --> I{"Admin verifies<br/>& approves?"}
    I -->|Rejected| J["Profile page only<br/>(see rejection remarks)"]
    I -->|Approved| K["Full portal access"]

    E --> L{"Onboarding<br/>status?"}
    L -->|Not approved| J
    L -->|Approved| K

    K --> M["Dashboard Overview<br/>active shipments, outstanding"]
    K --> N["Consignments<br/>view trip status + tracking"]
    K --> O["Requirements<br/>raise new vehicle need"]
    K --> P["Invoices<br/>view & download"]

    O --> Q["Fill requirement form<br/>route, vehicle type, cargo, date"]
    Q --> R["Requirement submitted<br/>status: OPEN"]
    R --> S["Admin reviews → creates Indent"]
    S --> T["Client sees indent progress<br/>in consignments tab"]

    T --> U["Trip executed by vendor/driver"]
    U --> V["POD received"]
    V --> W["Invoice generated"]
    W --> X["Accounts marks as PAID"]
    X --> Y["Trip CLOSED"]
```

**Note:** Client requirement creation happens ~0.1% of the time. The primary path is admin creating indents directly from phone/email requests.

### 2.2 Admin journey

```mermaid
flowchart TD
    A["Admin logs in"] --> B["Dashboard<br/>KPIs, pending actions"]

    B --> C["Onboarding Queue"]
    C --> C1["Review client docs → Approve/Reject"]
    C --> C2["Review vendor docs → Approve/Reject"]
    C --> C3["Review driver docs → Approve/Reject"]
    C --> C4["Review vehicle docs → Approve/Reject"]

    B --> D["Requirements Tab"]
    D --> D1{"Source?"}
    D1 -->|Client portal| D2["Review client requirement"]
    D1 -->|Phone/email| D3["Admin creates indent directly"]

    D2 --> E["Create Indent from Requirement"]
    D3 --> E

    E --> F["Enter consignor/consignee details<br/>vehicle type, material, freight terms"]
    F --> G["Indent created<br/>status: OPEN, unassigned"]

    G --> H["System broadcasts to eligible vendors<br/>(portal listing + future WhatsApp)"]
    H --> I["Vendors submit quotes<br/>(portal or WhatsApp, first-wins)"]

    I --> J["Admin sees top 5 vendor quotes"]
    J --> K["Admin allocates to chosen vendor"]
    K --> L["Vendor notified of assignment"]

    L --> M["Vendor assigns vehicle + driver"]
    M --> N{"Driver source?"}
    N -->|Vendor's driver| O["Vendor registered driver<br/>(must be KYC-approved)"]
    N -->|Pool driver| P["Request from ShunAssist pool"]
    P --> Q["Admin/system assigns certified driver"]

    O --> R["Trip created — PENDING"]
    Q --> R

    R --> S{"Driver device?"}
    S -->|Smartphone| S1["Driver app: GPS + in-app POD"]
    S -->|Feature phone| S2["Cell triangulation + ops/vendor POD"]
    S1 --> T["POD uploaded"]
    S2 --> T
    T --> U["Admin/Accounts creates invoice"]
    U --> V["Mark invoice as PAID"]
    V --> W["Trip CLOSED"]
```

### 2.3 Vendor (transporter) journey

```mermaid
flowchart TD
    A["Vendor visits TMS portal"] --> B{"Has account?"}
    B -->|No| C["Sign Up / Onboarding"]
    B -->|Yes| D["Login"]

    C --> E["Fill business details<br/>GST, PAN, fleet info"]
    E --> F["Upload documents"]
    F --> G["Admin verifies & approves"]
    G --> D

    D --> H{"Approved?"}
    H -->|No| I["Profile page only"]
    H -->|Yes| J["Full vendor portal"]

    J --> K["Available Indents<br/>(open, matching fleet)"]
    K --> L{"Want to quote?"}
    L -->|Portal| M["Submit quote via portal form<br/>rate + vehicle selection"]
    L -->|WhatsApp| N["Reply with quote via WhatsApp<br/>(future integration)"]

    M --> O{"Already quoted<br/>via other channel?"}
    N --> O
    O -->|Yes, other channel first| P["Quote rejected<br/>(first-wins rule)"]
    O -->|No| Q["Quote recorded<br/>channel locked"]

    J --> R["My Assignments<br/>(allocated indents/trips)"]
    R --> S["Select vehicle from approved list"]
    S --> T{"Need new vehicle?"}
    T -->|Yes| U["Add vehicle + upload docs<br/>→ verification queue"]
    T -->|No| V["Vehicle selected"]

    U --> W["Wait for admin approval"]
    W --> V

    V --> X{"Has driver?"}
    X -->|Yes| Y["Register driver on vendor portal<br/>name, phone, license, docs"]
    X -->|No| Z["Request driver from pool<br/>(ShunAssist)"]

    Y --> Y1["Driver account created<br/>source: VENDOR"]
    Y1 --> Y2{"Admin approves<br/>driver KYC?"}
    Y2 -->|Approved| Y3["Driver can use mobile app<br/>device: smartphone or feature phone"]
    Y2 -->|Pending/Rejected| Y4["Driver app: profile only"]

    Z --> AB["Pool driver assigned<br/>source: POOL (ShunAssist certified)"]
    Y3 --> AA["Driver + vehicle confirmed"]
    AB --> AA

    AA --> AC["Trip ready — awaiting driver pickup"]
    AC --> AD["Track trip progress<br/>(GPS or cell triangulation)"]
    AD --> AE["View payments & POD status"]
```

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

### 2.5 Driver app experience (React Native)

The driver app is **one app for all drivers**, but the home screen depends on **source + approval/certification status**:

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
    CACHE -->|Miss| QUERY["queries/*.ts"]
    QUERY --> PGB["PgBouncer"]
    PGB --> PG["PostgreSQL"]
    PG --> QUERY
    QUERY --> STORE["Store in Redis<br/>(TTL 30-60s)"]
    STORE --> RESP
```

### 3.2 Write path (API routes)

```mermaid
flowchart LR
    FORM["Client Component<br/>(form action)"] --> API["API Route Handler"]
    API --> AUTH["requireAuth()<br/>+ ownership check"]
    AUTH --> VALIDATE["Zod validation"]
    VALIDATE --> TX["Prisma transaction"]
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
    subgraph "src/app/ — Routes"
        DASH["(dashboard)/<br/>Admin pages"]
        PC["portal/client/<br/>Client pages"]
        PV["portal/vendor/<br/>Vendor pages"]
        DRV["driver/<br/>Driver web (legacy)"]
        ONB["onboard/<br/>KYC forms"]
        API_R["api/<br/>REST handlers"]
        MOB["api/mobile/<br/>Driver app API"]
    end

    subgraph "src/lib/ — Business Logic"
        AUTH_L["auth.ts"]
        QUERIES["queries/*.ts"]
        VALID["validation.ts"]
        LOGIC["logic.ts"]
        AUDIT_L["audit.ts"]
        NOTIFY_L["notifications.ts"]
        STORAGE_L["storage.ts"]
        SEQ["sequence.ts"]
        ADAPTERS["adapters/<br/>shunassist.ts<br/>whatsapp.ts"]
    end

    subgraph "src/components/"
        UI["ui/ — primitives"]
        FORMS["forms/ — feature forms"]
        SHELL["app-shell.tsx"]
        TABLE["data-table.tsx"]
    end

    DASH --> QUERIES
    PC --> QUERIES
    PV --> QUERIES
    API_R --> VALID
    API_R --> LOGIC
    API_R --> AUDIT_L
    API_R --> NOTIFY_L
    MOB --> VALID
    MOB --> LOGIC

    QUERIES --> AUTH_L
    FORMS --> API_R
    SHELL --> UI
    DASH --> SHELL
    TABLE --> UI
```

---

## 5. Authentication & Authorization Model

### 5.1 Role hierarchy

```mermaid
graph TD
    ADMIN["ADMIN<br/>(full access + permission management)"]
    OPS["OPERATIONS<br/>(indents, trips, onboarding)"]
    ACCOUNTS["ACCOUNTS<br/>(invoices, payments)"]
    CLIENT["CLIENT<br/>(portal: requirements, trips, invoices)"]
    VENDOR["VENDOR<br/>(portal: quotes, assignments, POD)"]
    DRIVER["DRIVER<br/>(mobile app: trips, courses, or KYC gate)"]

    ADMIN --> OPS
    ADMIN --> ACCOUNTS
    ADMIN -.->|future: configurable| PERM["Permission Matrix<br/>(per role / team / user)"]
```

### 5.2 Onboarding gate

```mermaid
flowchart LR
    SIGNUP["Sign Up"] --> SUBMIT["Submit KYC"]
    SUBMIT --> PENDING["Status: PENDING"]
    PENDING --> REVIEW["Admin reviews docs"]
    REVIEW -->|Approve| APPROVED["Status: APPROVED<br/>→ full portal access"]
    REVIEW -->|Reject| REJECTED["Status: REJECTED<br/>→ profile page only"]
    REJECTED --> RESUBMIT["Resubmit with corrections"]
    RESUBMIT --> PENDING
```

Applies to: Client, Vendor, Vehicle (verification). **Drivers** use the same KYC gate for vendor-registered drivers; independent drivers use the **certification gate** (ShunAssist courses) instead.

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
| Authorization | Middleware role routing + API allowlist + handler-level ownership checks |
| Future RBAC | Permission matrix per role/team/user (Phase 3) |
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
