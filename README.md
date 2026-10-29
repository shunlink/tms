# TMS — Transport Aggregator

A Transportation Management System built for Indian 3PL transport aggregators who
procure vehicles from the open market (fleet owners & brokers), manage documents,
bill clients, and pay vendors.

## Business Model
- Multiple **clients** raise vehicle requirements.
- You **procure** vehicles from **fleet owners / brokers**.
- You manage **LR, e-way bill, POD** and other documents.
- You **bill the client** and **pay the vendor**, tracking your **margin** per trip.

## Tech Stack
- **Next.js 14** (App Router) + **React 18**
- **Tailwind CSS** (custom UI primitives)
- **Prisma** ORM + **PostgreSQL** (local dev via Docker, or any Postgres instance)
- **NextAuth** (credentials) + route middleware
- **bcryptjs** for password hashing

## Quick Start

```bash
# Postgres + Redis in Docker; Next.js runs on the host (no app image build)
npm run docker:dev
# Or: docker compose -f docker-compose.example.yml up -d
# Optional: cp docker-compose.example.yml docker-compose.yml  →  docker compose up -d
npm install
npm run db:generate        # generate Prisma client
npm run db:migrate:deploy  # apply migrations to PostgreSQL
npm run db:seed            # load demo data + admin user
npm run dev                # http://localhost:3000
```

**Login:** `admin@tms.local` / `admin123`

### Demo users (all password `admin123`)
| Email | Role | Access |
|-------|------|--------|
| `admin@tms.local` | ADMIN | Full internal dashboard |
| `ops@tms.local` | OPERATIONS | Internal dashboard |
| `accounts@tms.local` | ACCOUNTS | Internal dashboard |
| `client@tata.local` | CLIENT | `/portal/client` (Tata Steel) |
| `vendor@sharma.local` | VENDOR | `/portal/vendor` (Sharma Transport) |
| `driver@tms.local` | DRIVER | `/driver` (Ravi Kumar) |

### Database
The app uses **PostgreSQL**. Set `DATABASE_URL` in `.env` to your connection string
(default: `postgresql://tms:tms@localhost:5432/tms?schema=public`), then run
`npm run db:migrate:deploy`. Local Docker is **db + redis only** (`docker-compose.example.yml`);
production uses `docker-compose.production.yml` (full stack with app build). VPS deploy zips
do not bundle server `docker-compose.yml` — see `scripts/package-deploy.ps1`.
Enum values are stored as strings for simplicity.

## Modules
| Module | Route |
|--------|-------|
| Dashboard (KPIs, actions) | `/` |
| **Indents** (client requirement) | `/indents`, `/indents/new`, `/indents/[id]` |
| Clients | `/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit` |
| Vendors | `/vendors`, `/vendors/new`, `/vendors/[id]`, `/vendors/[id]/edit` |
| Vehicles | `/vehicles`, `/vehicles/new`, `/vehicles/[id]`, `/vehicles/[id]/edit` |
| Drivers | `/drivers`, `/drivers/new` |
| Requirements | `/requirements`, `/requirements/new`, `/requirements/[id]` (auto-match) |
| Trips | `/trips`, `/trips/new`, `/trips/[id]` |
| Invoices | `/invoices`, `/invoices/new`, `/invoices/[id]` (printable) |
| Vendor Payments | `/payments` |
| **Client Portal** | `/portal/client` (overview, trips, requirements, invoices) |
| **Vendor Portal** | `/portal/vendor` (overview, trips + POD upload, payments, profile) |
| **Driver App (PWA)** | `/driver` (assigned trips, status, GPS share, POD upload) |
| **Reports** | `/reports` (lane rates, profitability, vendor scorecard, ageing) |
| **Notifications** | `/notifications` (client message outbox) |
| **Users** (admin) | `/users` (create internal/client/vendor/driver logins) |
| **Audit Log** (admin) | `/audit` (recent admin & financial actions) |
| Settings | `/settings` |
| Login | `/login` |

## Production Hardening
- **Input validation** — all API writes are validated with **Zod** (`src/lib/validation.ts`)
- **Rate limiting** — login attempts are throttled (`src/lib/ratelimit.ts`)
- **Security headers** — set globally in `next.config.js`
- **Health check** — public `GET /api/health` (200 ok / 503 degraded) for probes
- **Audit log** — key mutations are recorded (`src/lib/audit.ts`) and viewable at `/audit`
- **CSV exports** — `/api/export/{clients|vendors|vehicles|drivers|trips|invoices|payments}`
- **Pluggable providers** — notifications (`console`/`whatsapp_cloud`) in `src/lib/notify.ts`;
  storage (`local`/`s3`) in `src/lib/storage.ts`
- **LR PDF generation** — on **Create LR** (trip from indent), a 4-copy A4 lorry receipt PDF is
  rendered with Puppeteer (`src/lib/pdf/render-html-to-pdf.ts`). Set **`CHROME_PATH`** to the full
  path of Chrome or Edge (e.g. `C:\Program Files\Google\Chrome\Application\chrome.exe` on Windows).
  Trip creation still succeeds if the browser is missing; ops can **Regenerate** from the trip page.
- **Client tax invoice PDF** — BuckleTrack-style bulk GST invoice (multi-LR per document) via
  **Download PDF** on `/invoices/[id]` or `GET /api/invoices/[id]/pdf` (same `CHROME_PATH` requirement).
- **Automated tests** — Vitest unit tests for core logic (`npm test`)

## Notifications & Processing
Outbound messages go through `src/lib/notify.ts`. Recipients are normalized to
canonical E.164 digits (country code first, no `+`) by `src/lib/phone.ts`, so a
number typed as `9820012345`, `+91 98200 12345` or `09820012345` is always stored
and sent as `919820012345`. Delivery is immediate: `deliverNow()` writes an outbox
row and sends it, recording the provider response in `Notification.error`. The
**Process Outbox** action on `/notifications` retries anything still `PENDING`.

The provider is selected with `NOTIFY_PROVIDER`: `console` in dev, `whatsapp_cloud`
for the Meta Cloud API.

### WhatsApp (Meta Cloud API)
Vendors are notified when an indent is **released to vendors**. The message carries
load detail (route, vehicle, weight, cargo, dates, advance paid) and a **Submit my quote**
button that opens a **login-free quote page** (`/quote/{token}`) unique to each vendor.
Vendors can also submit on **Open Indents** (`/portal/vendor/indents`) after sign-in; both
paths create `VendorQuote` (channel `WHATSAPP` or `PORTAL`). WhatsApp text replies are not
accepted for new quotes—inbound messages receive a link to the quote page.

Set `PUBLIC_BASE_URL` (or `NEXTAUTH_URL`) to your public https app URL so CTA links work.

**Approved template (`WHATSAPP_BID_TEMPLATE_NAME`):** add a URL button in Meta whose
target uses one dynamic segment. By default the app sends the path+query
(`/quote/{token}`) as button parameter `{{1}}` with a static host in the template. Set
`WHATSAPP_BID_TEMPLATE_URL_MODE=full` to pass the entire https quote-page URL as `{{1}}`
instead.

| Piece | Location |
|-------|----------|
| Message text | `src/lib/whatsapp-message.ts` (pure, unit-tested) |
| Outbound broadcast | `src/lib/services/broadcast.service.ts` |
| Inbound quotes | `POST /api/webhooks/whatsapp/quotes` |
| Health / diagnostics | `GET /api/notifications/whatsapp-status` |
| Test send | `POST /api/notifications/whatsapp-status` |

```bash
# What is configured, and did messages actually leave?
curl -H "Cookie: <session>" http://localhost:3000/api/notifications/whatsapp-status

# Send a plain ping to one number
curl -X POST -H "Content-Type: application/json" -H "Cookie: <session>" \
  -d '{"to":"9820012345"}' http://localhost:3000/api/notifications/whatsapp-status

# Preview + send the real indent message (byte-for-byte what vendors get)
curl -X POST -H "Content-Type: application/json" -H "Cookie: <session>" \
  -d '{"to":"9820012345","indentId":"<indent-id>"}' \
  http://localhost:3000/api/notifications/whatsapp-status
```

#### Testing the webhook locally with ngrok
```bash
ngrok http 3000
```
Set `PUBLIC_BASE_URL` in `.env` to the https ngrok URL, then in the Meta app
dashboard point the WhatsApp webhook at
`https://<your-id>.ngrok-free.app/api/webhooks/whatsapp/quotes`, using
`WHATSAPP_VERIFY_TOKEN` as the verify token and subscribing to the `messages` field.
Set `WHATSAPP_APP_SECRET` to enforce Meta's `X-Hub-Signature-256` on inbound POSTs
(leave it unset to accept unsigned traffic during local testing).

Sandbox notes: a Meta **test number** only delivers to recipients listed under
*WhatsApp → API Setup → To*. On a verified business number, messages sent outside
the 24-hour customer window require an approved message template.

## Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md). Quick start with Docker:
```bash
cp .env.production.example .env.production
# edit secrets and URLs, then:
docker compose up -d --build
docker compose exec app npm run db:seed   # empty DB only — wipes data
```
`GET /api/health` is the health probe. For multiple instances, switch Prisma to
PostgreSQL and set `STORAGE_DRIVER=s3` (see DEPLOYMENT.md).

## Roles & Access
| Role | Home | Can access |
|------|------|-----------|
| ADMIN / OPERATIONS / ACCOUNTS | `/` | Full internal app + all documented APIs |
| CLIENT | `/portal/client` | Own trips, requirements, invoices; can raise requirements |
| VENDOR | `/portal/vendor` | Assigned trips, POD upload, payments, profile |
| DRIVER | `/driver` | Own trips only; update status, share GPS, upload POD |

Role routing and API authorization are enforced in `src/middleware.ts`.
Portal/driver roles are blocked from internal APIs (`403`), and vendor/driver
document uploads and status updates are ownership-checked against the trip.

## Indent (Client Requirement)
The dedicated **Indents** menu captures a detailed client requirement:
- **Consignor (pickup)** and **Consignee (delivery)**: name, address, city/state,
  pincode, GSTIN, contact, phone, pickup/delivery date & time
- **Vehicle requirement**: type, body type, number of vehicles
- **Material**: description, packing, packages, weight, value, HSN, invoice no/value
- **Freight & billing**: client rate, freight type (FOR/To-Pay), payment mode
  (TBB/Cash/Credit), e-way bill required, special instructions
- **Allocation**: assign vendor, vehicle and driver, then **Convert to Trip** to
  generate an LR in one click (`/api/indents/[id]/convert`)
- Indent-scoped **document uploads**

### Indent workflow
Each indent follows a guided pipeline shown as a stepper on the detail page:

1. **Created** — capture the requirement
2. **Documents** — upload the client invoice + vehicle documents
3. **Approval** — submit for senior approval; **only Admin (senior) can Approve/Reject**
4. **Advance** — record the vendor advance (amount, mode, reference)
5. **POD** — upload POD and mark POD received
6. **Completed** — record the balance payment

Actions are exposed at `/api/indents/[id]/workflow` (`submit_for_approval`,
`approve`, `reject`, `record_advance`, `mark_pod`, `record_balance`) with guard
rails (e.g. advance is blocked until approved) and full audit logging.

## Client / Vendor / Vehicle Onboarding
Onboarding forms capture detailed fields with a supporting **document upload**
facility (view/edit from each record's detail page):
- **Client**: legal name, industry, website, GSTIN/PAN/CIN/MSME, contacts,
  billing & shipping addresses, credit limit/terms/security deposit, bank details.
  Documents: GST, PAN, CIN, MSME, bank proof, agreement.
- **Vendor**: contact/WhatsApp, GSTIN/PAN/MSME, address, full bank + UPI,
  payment terms, TDS applicability. Documents: GST, PAN, MSME, bank proof, agreement.
- **Vehicle**: body type, make/model/year, tonnage, ownership, RC, insurance
  (company + IDV), fitness, PUC, permit, GPS device, FASTag.
  Documents: RC, insurance, fitness, PUC, permit.

Uploaded documents are stored via the storage adapter and served through an
authenticated `/files/[...path]` route (works for internal, client, vendor and
driver logins).

## Reports
`/reports` provides:
- **Outstanding ageing** (not due / 1–30 / 31–60 / 60+ days)
- **Lane rate benchmarking** (avg client & vendor rate, avg margin, range per lane)
- **Client profitability** (revenue, margin, margin %, outstanding)
- **Vendor scorecard** (trips, active, completion %, margin generated, pending payable)

## Notification Outbox
Every outbound message is recorded in the `Notification` table (channel, recipient,
subject, body, `status`, `attempts`, `error`, `sentAt`) and shown on `/notifications`.
Trip status changes queue client messages automatically via `src/lib/notifications.ts`.
See [Notifications & Processing](#notifications--processing) for the WhatsApp setup,
delivery semantics and the diagnostics endpoint.

## Driver App (PWA)
`/driver` is a mobile-first view: drivers see assigned trips, tap to advance
status (Dispatch → In Transit → Delivered), share GPS location via the browser
`navigator.geolocation`, and upload the POD. (A web app manifest for installable
PWA is a future add.)

## Vendor Auto-Matching
The requirement detail page (`/requirements/[id]`) scores available vehicles by
exact/similar vehicle type, vendor rating, prior trips on the same lane, and
current availability — then offers one-click "Allocate" into the trip form.

## Live Tracking
Operators (and vendors) post GPS pings per trip via `/api/trips/[id]/tracking`.
The latest ping is shown to clients on `/portal/client/trips` with an
OpenStreetMap link, and the full ping history appears on the trip detail page.

## API
All endpoints require an authenticated session (protected by middleware).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/clients` | List / create clients |
| GET/PATCH/DELETE | `/api/clients/[id]` | Client detail / update / delete |
| GET/POST | `/api/vendors` | List / create vendors |
| GET/PATCH/DELETE | `/api/vendors/[id]` | Vendor detail / update / delete |
| GET/POST | `/api/vehicles` | List / create vehicles |
| GET/PATCH/DELETE | `/api/vehicles/[id]` | Vehicle detail / update / delete |
| GET/POST | `/api/drivers` | List / create drivers |
| GET/PATCH/DELETE | `/api/drivers/[id]` | Driver detail / update / delete |
| GET/POST | `/api/requirements` | List / create requirements |
| GET/PATCH | `/api/requirements/[id]` | Requirement detail / update |
| GET/POST | `/api/indents` | List / create indents |
| GET/PATCH | `/api/indents/[id]` | Indent detail / update + allocate |
| POST | `/api/indents/[id]/convert` | Convert indent to a trip (LR) |
| POST | `/api/indents/[id]/workflow` | Workflow action (submit/approve/reject/advance/pod/balance) |
| GET/POST | `/api/documents` | List / upload onboarding documents |
| GET | `/files/[...path]` | Serve an uploaded document (authenticated) |
| GET/POST | `/api/trips` | List / create trips (auto LR + margin) |
| GET/PATCH | `/api/trips/[id]` | Trip detail / status updates |
| POST | `/api/trips/[id]/documents` | Upload trip document (own trip for VENDOR) |
| GET/POST | `/api/trips/[id]/tracking` | List / add GPS tracking pings |
| DELETE | `/api/documents/[id]` | Delete a document (and its file) |
| GET/POST | `/api/invoices` | List / create GST invoice from trips |
| GET/PATCH | `/api/invoices/[id]` | Invoice detail / mark paid |
| GET/POST | `/api/payments` | List / create vendor payments (advance, TDS, net) |
| PATCH | `/api/payments/[id]` | Update / mark payment paid |
| PATCH | `/api/notifications/[id]` | Mark a queued notification as sent |
| GET | `/api/dashboard` | Aggregated KPIs |

## Business Logic Highlights
- **Margin** = `clientRate − vendorRate`, computed on trip create/update.
- **LR / REQ / INV numbers** are auto-generated sequentially.
- **Requirement allocation** status updates automatically as trips are created.
- **Trip workflow**: `PENDING → DISPATCHED → IN_TRANSIT → DELIVERED → POD_RECEIVED → INVOICED → CLOSED` with timestamps captured automatically; `CANCELLED` from any active state.
- **Invoicing** only includes trips with POD (POD-gated billing) and marks them `INVOICED`; invoice page is print/PDF-ready.
- **Vendor payment** net = `amount − advance − TDS`; pending payments can be marked paid.
- **Documents** (LR, e-way bill, POD, challan, gate pass) upload per trip and are stored under `public/uploads/<tripId>/`.
- **Compliance alerts** flag insurance/fitness/PUC/license expiries within 30 days.

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run db:migrate` | Run DB migrations |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Roadmap
See [ROADMAP.md](./ROADMAP.md) for the phased plan and [PRD.md](./PRD.md) for requirements.

## Status
**Phase 6 complete.** Added a dedicated **Indents** module for capturing detailed
client requirements (consignor/consignee, vehicle, material, freight) with
vendor/vehicle/driver allocation and one-click **Convert to Trip**; plus much
richer **Client/Vendor/Vehicle onboarding** with a document-upload facility
(GST, PAN, RC, insurance, fitness, PUC, permit, agreements, etc.) served through
an authenticated `/files` route.

Earlier: complete aggregator workflow, Client/Vendor/Driver portals, analytics
reports, notification outbox, and production hardening (validation, rate
limiting, security headers, health checks, audit log, CSV exports, tests, Docker).

Recent: **PostgreSQL via Docker**, **maps geocoding** (Nominatim/Google), **driver
auto-location** (no manual entry), **POD camera capture** with a QR-code
hand-off for laptop users, and a **vendor POD-pending alert card**.

Remaining production work: S3 storage, real WhatsApp/SMS + maps APIs,
e-way bill / GST integrations, and CI/CD. Run `npm test` and `npm run build`
before shipping.
