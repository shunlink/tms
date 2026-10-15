# TMS Roadmap — 3PL Transport Aggregator

## Business Model
You are a **transport aggregator / broker**:
- **Clients** (manufacturers, traders, e-commerce) ask for vehicles.
- You **procure vehicles** from **Fleet Owners** and **Brokers** in the open market.
- You **manage documents** (LR, e-way bill, POD, invoices).
- You **bill the client** and **pay the vendor**, keeping your **margin/spread**.

---

## Phase 1 — Foundation (Weeks 1-4)
**Goal:** Digitize the core ledger so nothing is lost on paper or WhatsApp.

| Module | Features |
|--------|----------|
| **Master Data** | Add Clients, Vendors (Fleet Owners / Brokers), Vehicles, Drivers |
| **Vehicle Requirement** | Client raises a requirement (route, vehicle type, date, cargo details) |
| **Vehicle Procurement** | Match requirement to a vendor vehicle; confirm rate with vendor |
| **Trip / LR Creation** | Auto-generate LR number; capture vehicle, driver, vendor, client details |
| **Document Upload** | Upload e-way bill, insurance, RC, fitness, driver license |
| **Basic Dashboard** | Total trips today, pending POD, outstanding client bills, pending vendor payments |

**Tech Deliverables:**
- Next.js + Tailwind UI
- Prisma schema for Master + Trips + Documents
- Auth (simple email/password or OTP)

---

## Phase 2 — Money Flow & Compliance (Weeks 5-8)
**Goal:** Close the loop on billing, payments, and compliance.

| Module | Features |
|--------|----------|
| **Client Billing** | Generate freight invoice to client (with GST); link to trip/LR |
| **Vendor Payment** | Record vendor freight payable; advance payment tracking |
| **Margin Tracker** | Auto-calculate spread: Client Rate − Vendor Rate = Margin per trip |
| **Outstanding** | Client ageing report (30/60/90 days); vendor payment schedule |
| **Compliance Alerts** | Expiry alerts for vehicle insurance, fitness, PUC, driver license |
| **POD Workflow** | Mark POD received → trigger client invoice; no POD = no billing |

**Tech Deliverables:**
- Invoice PDF generation
- Payment ledger tables
- Cron jobs / scheduled alerts for compliance

---

## Phase 3 — Operations & Optimization (Weeks 9-12)
**Goal:** Scale without adding headcount proportionally.

| Module | Features |
|--------|----------|
| **GPS Tracking** | Integrate GPS device or driver mobile app for live tracking |
| **Client Portal** | Client login to raise requirements, track trips, download invoices |
| **Vendor Portal** | Vendor login to view assigned trips, upload POD, view payment status |
| **Auto Matching** | Suggest best vendor for a requirement based on past performance, rate, availability |
| **Mobile App (Driver)** | Mark trip start/stop, upload POD photo, share location |
| **WhatsApp Bot** | Client/vendor can request trip status via WhatsApp |

**Tech Deliverables:**
- GPS API integration (MapMyIndia / Google / DelightTrack)
- Separate role-based portals
- React Native / Flutter driver app (or PWA)

---

## Phase 4 — Intelligence & Growth (Months 4-6)
**Goal:** Use data to win more business and improve margins.

| Module | Features |
|--------|----------|
| **Lane Pricing Intelligence** | Historical rate per km per lane; benchmark against market |
| **Vendor Scorecard** | On-time %, damage %, rate competitiveness, document timeliness |
| **Client Profitability** | Revenue − vendor cost − collection cost = net client margin |
| **Freight Marketplace** | If a vendor has backload, post to your network and take commission |
| **Fuel & Toll Reconciliation** | FASTag reconciliation, fuel card linkage |
| **Financing** | Offer invoice discounting to clients or vendor advance via NBFC partner |

---

## Data Model Overview

```
Client → Requirement → Trip ← Vehicle ← Vendor
                         ↓
                    Documents (LR, e-way, POD)
                         ↓
            ClientInvoice ←→ VendorPayment
                         ↓
                    Margin = ClientRate - VendorRate
```

---

## Key Indian Compliance Checklist
- [ ] GST-compliant invoices (HSN code 9965 / 9967)
- [ ] E-way bill integration (NIC API)
- [ ] E-invoicing (if turnover > threshold)
- [ ] Vehicle docs: RC, Insurance, Fitness, PUC
- [ ] Driver docs: License, Police Verification (if required)
- [ ] TDS on vendor payments (if applicable)

---

## Success Metrics (KPIs)
| Metric | Target |
|--------|--------|
| Trips managed per ops person | 50 → 150 |
| POD collection time | 7 days → 2 days |
| Client billing cycle | 15 days → 3 days |
| Vendor payment accuracy | 95% → 99.5% |
| Margin visibility | Manual guess → real-time per trip |
| Document compliance | 70% → 100% |
