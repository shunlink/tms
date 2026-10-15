# PRD — Transport Aggregator TMS

## 1. Product Vision
A web-based TMS built specifically for Indian 3PL transport aggregators who procure vehicles from the open market and need to manage requirements, trips, documents, and money flow in one place.

## 2. Users & Roles
| Role | What they do |
|------|-------------|
| **Admin / Owner** | Full access; view margins, outstanding, compliance |
| **Operations** | Create requirements, allocate vendors, track trips, collect POD |
| **Accounts** | Generate invoices, record payments, reconcile |
| **Client (portal)** | Raise requirements, track trips, download invoices |
| **Vendor (portal)** | View assigned trips, upload docs, check payment status |
| **Driver (mobile)** | Update trip status, upload POD, share location |

## 3. Core Modules

### 3.1 Master Data
- **Clients:** Company name, GSTIN, billing address, credit limit, payment terms
- **Vendors:** Name, type (Fleet Owner / Broker), GSTIN, bank details, rating
- **Vehicles:** Number, type (14ft / 17ft / 20ft / 32ft / container), capacity, docs
- **Drivers:** Name, phone, license number, expiry dates

### 3.2 Requirement → Trip Flow
```
1. Client Requirement
   - Route (From → To)
   - Vehicle type & qty
   - Cargo details
   - Expected date
   - Client budget/quoted rate

2. Vendor Allocation
   - Search available vendors by route preference
   - Confirm vendor rate
   - Assign vehicle & driver
   - Auto-generate LR

3. Trip Execution
   - Vehicle dispatched
   - GPS tracking (optional in MVP)
   - Delivery confirmed
   - POD collected

4. Closure
   - Client invoice generated
   - Vendor payment recorded
   - Margin calculated
```

### 3.3 Document Management
| Document | Uploaded By | Needed Before |
|----------|-------------|---------------|
| LR (Lorry Receipt) | Operations | Trip start |
| E-way Bill | Operations | Trip start |
| Vehicle RC | Vendor/Admin | Always valid |
| Insurance | Vendor/Admin | Always valid |
| Fitness | Vendor/Admin | Always valid |
| Driver License | Driver/Admin | Always valid |
| POD | Driver/Operations | Client billing |
| Gate Pass / Delivery Challan | Client | Trip start |

### 3.4 Billing & Payments
- **Client Invoice:** Freight amount + GST + other charges (loading, unloading, detention)
- **Vendor Payment:** Freight payable + advance deduction + TDS (if any)
- **Margin:** Client freight − Vendor freight
- **Advance Tracking:** Record advance given to vendor/driver; deduct from final payable

### 3.5 Dashboard & Alerts
- Today's trips (loaded, in-transit, delivered)
- Pending PODs
- Client outstanding > 30 days
- Vendor payments due
- Document expiries in next 30 days
- Low-margin trip alerts

## 4. Tech Stack
| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js (credentials + OTP) |
| File Storage | Local / AWS S3 |
| PDF | Puppeteer / react-pdf |
| Maps | Google Maps / MapMyIndia (later) |

## 5. Pages / Routes
```
/auth/login
/dashboard
/clients
/clients/[id]
/vendors
/vendors/[id]
/vehicles
/vehicles/[id]
/drivers
/drivers/[id]
/requirements
/requirements/[id]
/trips
/trips/[id]
/trips/create
/invoices
/invoices/[id]
/payments
/payments/vendor
/documents
/reports/margins
/reports/outstanding
/reports/compliance
/settings
```

## 6. Non-Functional Requirements
- Responsive (works on laptop + tablet for warehouse use)
- Print-friendly LR and invoices
- Data export to Excel
- Role-based access control
- Audit log for all financial transactions
