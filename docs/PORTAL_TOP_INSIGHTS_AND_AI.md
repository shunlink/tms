# Portal top insights & AI (existing data only)

Short list based on `prisma/schema.prisma` and what `src/app/portal/**` actually shows today. **No new DB tables** — only UI + read queries.

## Client — not shown yet (data stored)

| # | Insight / feature | Tables / fields |
|---|-------------------|-----------------|
| 1 | Credit used vs **credit limit** | `ClientCommercial.creditLimit`, unpaid `ClientInvoice` |
| 2 | **Overdue** invoice count & amount | `ClientInvoice.dueDate`, `status`, `paidAmount` |
| 3 | **All payments** list | `ClientPayment` (+ proof `StoredFile`) |
| 4 | Requirement → **indent** number & status | `Requirement.indent`, `Indent.indentNumber`, `Indent.status` |
| 5 | **Requirement detail** (cargo, parties, dates) | `Requirement.*` |
| 6 | **Trip detail** (milestones, freight) | `Trip.dispatchedAt`, `deliveredAt`, `podReceivedAt`, `clientRate`, `cargoSummary` |
| 7 | **Trip / indent documents** | `DocumentAttachment`, `IndentPod` |
| 8 | **E-way bill** on shipment | `IndentEwayBill` |
| 9 | **Tracking history** | `TrackingPing` (list shows latest ping only) |
| 10 | **Indent pipeline** for your loads | `Indent` (`status`, `placementStatus`, `advanceStatus`) |

## Vendor — not shown yet (data stored)

| # | Insight / feature | Tables / fields |
|---|-------------------|-----------------|
| 1 | **Open / allocated** indent counts | Already in `getVendorPortalOverview`; not on UI |
| 2 | **Quote history** & outcomes | `VendorQuote` |
| 3 | **Per-trip payable** breakdown | `VendorTripPayable` |
| 4 | **Balance payment** status & SLA | `VendorBalancePaymentTask`, `VendorBalancePayment` |
| 5 | **Deductions / detention** | `TripCharge` |
| 6 | **Placement deadline** | `IndentAllocation.deadlineAt` |
| 7 | **Fleet compliance** expiry | `VehicleCompliance` |
| 8 | **Vendor rating** | `Vendor.rating` (in query, not profile UI) |
| 9 | Delivery date & **cargo type** on open loads | In `getVendorOpenIndents` JSON, not on cards |
| 10 | **POD verification** detail | `IndentPod.status`, `rejectionReason` |
| 11 | **Financial notes** (issued) | `FinancialNote` (`vendorId`) |

## AI (grounded in same data)

| Portal | Feature |
|--------|---------|
| **Client** | Natural-language Q&A on trips, invoices, requirements |
| **Client** | Weekly ops + billing summary (counts & dates from DB) |
| **Client** | Plain-English invoice line explainer |
| **Client** | Lane spend ranking from `Trip` / invoice lines |
| **Client** | Optional POD/LR readability check on uploaded files |
| **Vendor** | Natural-language Q&A on payments, payables, open indents |
| **Vendor** | Monthly earnings narrative from `VendorPayment` |
| **Vendor** | Quote range hint from own past `VendorQuote` + lanes |
| **Vendor** | “What to do next” from trip/POD/advance/balance statuses |
| **Vendor** | Optional POD photo quality coach on upload |

**DOCX:** `docs/PORTAL_TOP_INSIGHTS_AND_AI.docx` (generate with `node scripts/generate-portal-insights-docx.mjs`).
