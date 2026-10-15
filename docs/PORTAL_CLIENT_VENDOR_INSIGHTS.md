# Client & Vendor Portal — Features & Insights (Existing Data Only)

> **Shorter list (recommended):** see [`PORTAL_TOP_INSIGHTS_AND_AI.md`](./PORTAL_TOP_INSIGHTS_AND_AI.md) and [`PORTAL_TOP_INSIGHTS_AND_AI.docx`](./PORTAL_TOP_INSIGHTS_AND_AI.docx).

---

This document lists **portal UX features and read-only insights** you can add using data that already exists in PostgreSQL (Prisma schema) and patterns already used in `src/lib/queries.ts` — **no new tables, migrations, or auth flows**.

**Constraint:** Implement as **server components / extended read queries** (same as today). Avoid new public APIs unless you later choose to; portal pages already load data via `getSessionUser()` + Prisma in `queries.ts`.

**Current portal surface (baseline):**

| Area | Client | Vendor |
|------|--------|--------|
| Overview KPIs | Active / delivered trips, outstanding invoice balance, recent trips | Active / completed trips, POD pending, pending pay, paid to date, recent trips |
| Lists | Requirements, trips (incl. last ping + invoice link), invoices | Open indents (quote), assigned trips/assignments, payments |
| Profile | Client profile + documents (`/api/portal/profile`, `/api/portal/documents`) | Vendor profile + documents |
| Actions | Create requirement (`POST /api/requirements`), view invoice detail | Quote on indent, POD upload, advance voucher links |

---

## Shared data primitives (both portals)

These models are already scoped by `clientId` or `vendorId` on `Indent`, `Trip`, `Requirement`, invoices, and payments:

| Domain | Key models | Useful fields |
|--------|------------|----------------|
| Lifecycle | `Indent`, `IndentLine`, `Trip` | `status`, `placementStatus`, `advanceStatus`, dates (`indentDate`, `releasedAt`, `vendorAllocatedAt`, `dispatchedAt`, `deliveredAt`, `podReceivedAt`, `podVerifiedAt`) |
| Locations | `IndentLoadingLocation`, `IndentUnloadingLocation`, `Address` | Cities, pincodes, `scheduledAt`, party/contact |
| Cargo / commercial | `IndentConsignment`, `IndentCargo`, `IndentClientFreight` | Vehicle type, weight, pickup/delivery windows, `clientRate`, GST flags |
| Compliance docs | `DocumentAttachment`, `StoredFile`, `IndentPod` | `documentType` (POD, LR, EWAY_BILL, …), POD `status` / `resolutionStatus` |
| Tracking | `TrackingPing` | `lat`, `lng`, `recordedAt`, `source` (GPS/CELL) |
| E-way | `IndentEwayBill` | Number, validity, origin/destination |
| Onboarding | `OnboardingCase` | `status`, `remarks`, `submittedAt`, `reviewedAt` |
| Finance (client) | `ClientInvoice`, `ClientInvoiceLine`, `ClientPayment`, `InvoiceTask` | Amounts, due dates, paid vs total, SLA on invoicing after POD |
| Finance (vendor) | `VendorQuote`, `IndentAllocation`, `VendorPayment`, `AdvanceRequest`, `VendorTripPayable`, `VendorBalancePaymentTask`, `VendorBalancePayment`, `TripCharge` | Rates, payables, TDS, advance/balance workflow, deductions |
| Fleet (vendor) | `Vehicle`, `VehicleCompliance`, `Driver` | RC/insurance/fitness expiry, verification status |
| Alerts (read-only mirror) | `ImportantEvent`, `SlaTask` | Type, severity, `dueAt`, link to `indentId` / trip via entity |

---

## Client portal — recommended features & insights

### 1. Operations dashboard (Overview enhancements)

| Insight / widget | What to show | Data source |
|------------------|--------------|-------------|
| **Requirement funnel** | Count OPEN → CONVERTED → CANCELLED; conversion rate | `Requirement` (`status`, `convertedAt`, `indent`) |
| **Indent pipeline** | Buckets: quoting, allocated, in transit, delivered, POD pending, completed | `Indent` where `clientId`, `status` |
| **On-time delivery (simple)** | % trips with `deliveredAt` ≤ `IndentConsignment.deliveryAt` (or requirement `deliveryAt`) | `Trip` + `Indent` → `consignment` / `Requirement` |
| **Active shipment map** | Pins from latest `TrackingPing` per active trip | `Trip` + `TrackingPing` (already partial on trips list) |
| **POD status summary** | Trips awaiting POD verification vs verified | `IndentPod` via `Trip` / `Indent` |
| **Upcoming pickups** | Next 7 days by `IndentConsignment.pickupAt` or loading `scheduledAt` | `Indent` + `loading` / `consignment` |

### 2. Requirements & indents visibility

| Feature | Description | Data source |
|---------|-------------|-------------|
| **Requirement detail drawer** | Full lane, cargo, consignor/consignee, special instructions | `Requirement` (many fields already on model) |
| **Link requirement → indent** | Show `indentNumber` and indent status when `status = CONVERTED` | `Requirement.indent` |
| **Indent timeline (read-only)** | Released → allocated → vehicle placed → in transit → delivered | `Indent` status + timestamps |
| **Placement / advance badges** | “Waiting for advance”, “Released to vendors”, placement failed | `Indent.advanceStatus`, `placementStatus`, `releasedAt` |

*Note:* Clients do not need vendor names on open indents before allocation; after `Trip` exists, vendor is already shown on trips.

### 3. Trips & visibility

| Feature | Description | Data source |
|---------|-------------|-------------|
| **Trip detail page** | Mirror vendor-style detail: driver name/phone (if policy allows), documents, milestone dates | `Trip`, `Driver`, `DocumentAttachment` (TRIP), `listDocuments` |
| **Tracking history** | Last N pings + sparkline / “last updated X min ago” | `TrackingPing` |
| **Milestone strip** | Dispatched → delivered → POD received → POD verified → invoiced | `Trip` dates + `InvoiceTask` / `ClientInvoiceLine` |
| **E-way snapshot** | Number + valid until on trip/indent card | `IndentEwayBill` via `Trip.indentId` |
| **Document hub per trip** | POD, LR, e-way attachments | `DocumentAttachment` where `entityType = TRIP` or `INDENT` |

### 4. Financial insights (no new billing logic)

| Insight | Description | Data source |
|---------|-------------|-------------|
| **Aging receivables** | Outstanding by bucket: current, 1–30, 31–60, 60+ days from `dueDate` | `ClientInvoice` (`totalAmount`, `paidAmount`, `dueDate`, `status`) |
| **Overdue count & amount** | KPI card + list | `status = OVERDUE` or `dueDate < today` and unpaid |
| **Payment history** | List payments with invoice/trip link and proof download | `ClientPayment` + `proofFile` |
| **Spend by route** | Top lanes by sum of `Trip.clientRate` or invoiced lines | `Trip` / `ClientInvoiceLine` (`routeFrom`, `routeTo`) |
| **Spend by month** | Chart from invoice `issueDate` or trip `deliveredAt` | `ClientInvoice`, `Trip` |
| **Avg freight per MT / lane** | When `loadingWeight` or consignment weight present | `Trip.loadingWeight`, `IndentConsignment.weightValue` |
| **Credit exposure** | Outstanding vs `ClientCommercial.creditLimit` | `ClientCommercial` + invoice outstanding |
| **Payment terms reminder** | “Due in N days” from `paymentTermsDays` on invoice snapshot | `ClientInvoice.paymentTermsDays`, `dueDate` |
| **Invoice SLA transparency** | “Invoice expected within 24h of POD verification” using task deadline | `InvoiceTask` filtered by `clientId` (read-only status) |

### 5. Compliance & account health

| Feature | Data source |
|---------|-------------|
| **Onboarding status card** | Submitted / approved / rejected + remarks | `OnboardingCase` |
| **GST verification badge** | Verified at, provider | `Client.gstVerificationStatus`, `gstVerifiedAt` |
| **KYC document checklist** | GST, PAN, etc. | `DocumentAttachment` on `CLIENT` |
| **Profile completeness** | Missing phone, GSTIN, primary address | `Client`, `ClientAddress`, `ClientCommercial` |

### 6. Client portal — suggested new nav sections (UI only)

- **Analytics** — aging, spend by route/month, funnel (all read-only).
- **Documents** — aggregate CLIENT + TRIP + INDENT docs for active shipments.
- **Payments** — dedicated page (data exists; today only embedded in invoice detail).

---

## Vendor portal — recommended features & insights

### 1. Operations dashboard (Overview enhancements)

| Insight / widget | What to show | Data source |
|------------------|--------------|-------------|
| **Open indent opportunities** | Count + total released today/week | `IndentVendorRelease`, `vendorOpenIndentWhere` (already counted in overview) |
| **Quote pipeline** | Submitted quotes: ACTIVE vs ACCEPTED vs REJECTED | `VendorQuote` (`status`, `quotedRate`, `submittedAt`) |
| **Win rate** | Accepted quotes / total quotes (time window) | `VendorQuote` |
| **Allocation clock** | Time left on placement deadline | `IndentAllocation.deadlineAt` (ACTIVE allocation) |
| **Fleet utilization** | Trips per vehicle / idle vehicles | `Trip`, `Vehicle` |
| **POD compliance score** | % trips with verified POD within SLA | `IndentPod`, `Trip.podVerifiedAt` |

### 2. Bidding & indents

| Feature | Description | Data source |
|---------|-------------|-------------|
| **My quotes history** | Rate submitted, channel (PORTAL/WHATSAPP), outcome | `VendorQuote` |
| **Open indent cards** | Lane, vehicle type, cargo summary, your last quote if any | Open indent service + `VendorQuote` |
| **Released indents map** | Cities from `IndentReleaseCity` / release record | `IndentVendorRelease`, `IndentReleaseCity` |
| **Allocated indent workspace** | Placement status, client name (already on assignments), rate from allocation | `Indent`, `IndentAllocation` |

### 3. Trips & execution

| Feature | Description | Data source |
|---------|-------------|-------------|
| **Trip financial snapshot** | Freight, advance applied, balance pending (read-only) | `VendorTripPayable` + `Trip.vendorRate` |
| **Deductions / detention visibility** | Line items before balance pay | `TripCharge` |
| **Advance request tracker** | Status, negotiated vs approved amount, UTR, voucher | `AdvanceRequest`, `AdvanceRequestEvent` |
| **Balance payment tracker** | Task status, deadline, partial payments | `VendorBalancePaymentTask`, `VendorBalancePayment` |
| **POD resubmission** | BAD_POD + `resolutionStatus` | `IndentPod` |
| **Driver & vehicle on trip** | Already in trip detail; add to list rows | `Trip` includes |

### 4. Payments & earnings insights

| Insight | Description | Data source |
|---------|-------------|-------------|
| **Earnings MTD / YTD** | Sum `VendorPayment.netPayable` where PAID | `VendorPayment` |
| **Advance vs balance split** | Already on payments page — trend chart | `VendorPayment.paymentType` |
| **Outstanding payables** | Already `computeOutstandingVendorPayables` — breakdown by trip | `VendorTripPayable` (`balanceAmount`, `balancePaidAmount`) |
| **TDS summary** | Sum `tdsAmount` by period | `VendorPayment`, `VendorTripPayable` |
| **Payment proof library** | All proofs + vouchers in one grid | `StoredFile` via payments / advance / balance task |
| **Per-lane earnings** | Group by `Trip.routeFrom` → `routeTo` | `Trip` + payments |
| **SLA transparency** | Balance payment 96h from POD verify | `VendorBalancePaymentTask.deadlineAt`, `slaBreachedAt` |

### 5. Fleet & compliance (vendor)

| Feature | Data source |
|---------|-------------|
| **Fleet list with compliance traffic lights** | RC, insurance, fitness, PUC expiry | `Vehicle` + `VehicleCompliance` |
| **Documents expiring in 30 days** | `*Expiry` fields on compliance |
| **Vehicle assignment history** | Trips per `Vehicle.registrationNumber` | `Trip.vehicleId` |
| **Driver roster** | Drivers on recent trips | `Driver` via `Trip` / `IndentAllocation` |
| **Beneficiary status** | Default payout account verified or pending | `VendorBeneficiary` (masked display only) |

### 6. Account & trust

| Feature | Data source |
|---------|-------------|
| **Vendor rating display** | Show `Vendor.rating` if set | `Vendor` |
| **Onboarding + GST verification** | Same pattern as client | `OnboardingCase`, `Vendor.gstVerification*` |
| **Financial notes (vendor-facing)** | Debit/credit notes issued to vendor | `FinancialNote` where `vendorId`, `status = ISSUED` |

### 7. Vendor portal — suggested new nav sections (UI only)

- **My quotes** — historical bidding performance.
- **Fleet** — vehicles + compliance (data already on `Vendor.vehicles`).
- **Payables** — trip-level payable + balance task status (extends Payments).
- **Analytics** — win rate, earnings trends, POD compliance.

---

## Cross-cutting UI patterns (no backend change)

1. **Status-driven empty states** — Use existing enums (`Indent.status`, `Trip.status`, invoice `status`) for contextual CTAs (e.g. client: “Raise requirement”; vendor: “Browse open indents”).
2. **SLA countdown badges** — `InvoiceTask.deadlineAt`, `VendorBalancePaymentTask.deadlineAt`, `AdvanceRequest.deadlineAt`, `IndentPod.slaDeadlineAt` (show to the party that owns the next action).
3. **Entity drill-down** — Requirement → Indent → Trip → Invoice/Payment on client; Indent → Trip → Payable/Payment on vendor.
4. **Charts** — Client: outstanding aging, trips per week. Vendor: quotes vs wins, net pay per month. All aggregations from existing rows.
5. **Export CSV** — Generate in server action from same Prisma queries (no new storage).

---

## Implementation notes

| Topic | Guidance |
|-------|----------|
| **Where to add reads** | Extend `src/lib/queries.ts` (e.g. `getClientPortalAnalytics`, `getVendorPortalAnalytics`) following `safeRead` + `clientId`/`vendorId` filters. |
| **Authorization** | Keep `getSessionUser()` in pages; never trust client-supplied IDs. Same rules as `getClientTrips` / `getVendorTrips`. |
| **What not to expose** | Other vendors’ quotes, internal margins (`Trip.margin`), full bank account numbers (`VendorBeneficiary.accountNumber`), employee audit logs, unreleased draft indents. |
| **Performance** | Prefer `aggregate` / `groupBy` for dashboards; cap time ranges (e.g. last 12 months). |
| **Bidding integration** | `Client.biddingCompanyId` / `Vendor.biddingCompanyId` — promo banner exists; deep links only, no new TMS data. |

---

## Suggested priority (impact vs effort)

### Client — Phase 1
1. Financial aging + overdue KPI on Overview  
2. Requirement funnel + indent status on Requirements page  
3. Trip detail with milestones + documents + e-way  
4. Payments list page (mirror invoice payments)  

### Client — Phase 2
5. Spend by route / month charts  
6. Credit limit vs outstanding  
7. Map view for active trips  

### Vendor — Phase 1
1. My quotes + win rate on Overview  
2. Payables breakdown per trip (VendorTripPayable) on Payments  
3. Advance / balance task status on trip detail  
4. Fleet compliance expiry widget  

### Vendor — Phase 2
5. Earnings trends + per-lane analytics  
6. Placement deadline countdown on assignments  
7. POD compliance / BAD_POD queue enhancements  

---

## Reference: primary Prisma relations by portal user

```
CLIENT user.clientId
  → Requirement → Indent? → Trip[] → TrackingPing[], IndentPod[], DocumentAttachment
  → Indent (direct) → consignment, loading, unloading, ewayBill, clientFreight
  → ClientInvoice → ClientInvoiceLine (Trip), ClientPayment
  → InvoiceTask (via clientId)
  → ClientCommercial, ClientAddress, OnboardingCase, DocumentAttachment (CLIENT)

VENDOR user.vendorId
  → VendorQuote, IndentAllocation, Indent (allocated), IndentVendorRelease
  → Trip[] → AdvanceRequest, VendorTripPayable, VendorBalancePaymentTask, TripCharge, IndentPod
  → VendorPayment, Vehicle[] → VehicleCompliance
  → VendorCommercial, VendorBeneficiary, OnboardingCase, DocumentAttachment (VENDOR)
```

---

*Generated from `prisma/schema.prisma` and `src/lib/queries.ts` portal functions as of the current codebase. Update this doc when new portal read models are added.*
