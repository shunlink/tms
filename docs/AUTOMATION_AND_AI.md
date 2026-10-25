# Shunlink TMS — Automation and AI

Document version: 1.1  
Audience: Product, engineering, operations  
Scope: What to build now vs later on the live TMS. Vendor allocation and payments stay human-approved.

Related: `ADVANCED_AI_FUTURE_SCOPE.md` / `.docx` (investor-grade future AI), `SHUNLINK_AI_IMPLEMENTATION.md` (agent wiring), `ARCHITECTURE_AND_USER_FLOW.md` (journeys).

---

## 1. Principles

- Solve problems clients and vendors actually report: truck location, payment status, what to do next on the portal.
- Prefer automation, business rules, and statistics on data you already store in PostgreSQL before adding LLMs.
- Any “AI” that touches money or legal outcomes is suggest-only; ops/finance confirms.
- Portal data must stay scoped to the logged-in client or vendor.

---

## 2. Current product (what exists and what is missing)

Clients use `/portal/client` for shipments (table only), requirements, and invoices. There is no shipment detail page with map and timeline. Last GPS may appear on the list as an external map link.

Vendors use `/portal/vendor` for open indents, quoting, trips, POD upload, bulk advance, and payments. WhatsApp notifies them when indents are released. It is not obvious which task is urgent or why a balance payment is still pending.

Drivers post location to `TrackingPing` via the driver app. Staff can use `LiveTrackingView` on internal trip/indent screens. Clients do not get the same experience.

Internal users have indents, placement, trips, POD queue, advances, invoices, payables, work queues (`work-queues.service.ts`), SLA escalation cron, lane rate reports (`getLaneRates`), and vendor matching on requirements (`scoreMatch` in `logic.ts`). Quote award is still largely manual comparison.

Integrations: GST, RC, DL verification (Surepass), WhatsApp outbound (`notify.ts`). Onboarding remains ops-heavy.

---

## 3. Implement now

Most items below do not require an LLM. They extend routes and services that already exist.

### 3.1 Client

1. Shipment tracking page  
   Use case: “Where is my truck?” without calling Shunlink.  
   Build: `/portal/client/trips/[id]` with vertical milestones (placed → dispatched → in transit → delivered → POD → invoiced), embedded map, auto-refresh while in transit. Reuse `LiveTrackingView`. Add `GET /api/portal/client/trips/[id]` and `.../tracking` filtered by session `clientId` (do not expose generic `/api/trips/[id]/tracking` to clients without ownership check). Link “Track” from the shipments list.

2. Milestone notifications  
   Use case: Client does not log in every day.  
   Build: On dispatch and delivery (and optionally invoice raised), send WhatsApp or email via `notify.ts` with a link to the tracking page.

3. Attention strip on client home  
   Use case: Show only blockers (unpaid invoice, active shipment needing action, rejected requirement).  
   Build: Extend patterns like `PortalAttentionCta`; no AI.

4. Shipment Watch (rules)  
   Use case: GPS stops updating while trip is in transit; client learns too late.  
   Build: Cron (e.g. `/api/cron/shipment-watch`) checks `TrackingPing` age and trip status; create client notification and optional ops `ImportantEvent`. Thresholds: e.g. no ping for 4 hours while `IN_TRANSIT`; optional long-stop heuristic from ping sequence.

5. ETA window (statistics)  
   Use case: Plan unloading at destination.  
   Build: Median transit time per `routeFrom` + `routeTo` (+ vehicle type if enough rows) from completed trips; show a date/time window on the tracking page. Label confidence low until you have enough lane history.

### 3.2 Vendor

1. Action list on vendor home  
   Use case: “What should I do first?”  
   Build: Single list: indents needing quote, assignments needing vehicle/driver, trips needing POD, advances to accept. Derive from existing portal queries.

2. Ranked open indents  
   Use case: Too many irrelevant loads in the list.  
   Build: Sort open indents using `VendorDeliveryZone`, vehicle type fit, and lane history (same scoring idea as `matchVendorsForRequirement` / `scoreMatch`). Show short reason text (“your zone”, “ran this lane before”).

3. Quote rate band on quote form  
   Use case: Vendors unsure what rate to bid.  
   Build: Show min/median/max or band from `getLaneRates` for that lane when submitting `VendorQuote`. Suggestion only.

4. Placement checklist before submit  
   Use case: Ops rejects assignment because RC, driver OTP, or e-way data is missing.  
   Build: Surface `checkIndentTripReadiness` failures on vendor placement UI.

5. Payment breakdown per trip  
   Use case: “Where is my balance?” support calls.  
   Build: Plain-language line items: agreed rate, advance paid, POD status, balance task status (`VendorBalancePaymentTask`), what step is blocking payout. No LLM.

6. POD upload warnings (optional light checks)  
   Use case: Finance rejects blurry or incomplete POD images.  
   Build: Before upload, warn on very small file, extreme blur heuristic, or missing back image. Full OCR is future.

### 3.3 Internal team

1. One priority inbox on dashboard  
   Use case: SLA items lost across placement, POD, advance, invoice queues.  
   Build: Merge counts from `work-queues.service` and active `SlaTask`; sort by deadline and severity.

2. Quote compare on indent  
   Use case: Slow award and margin mistakes.  
   Build: Side-by-side quotes with margin, `getLaneRates` benchmark, vendor scorecard fields you already report. Highlight outlier bids; suggest lowest compliant margin — human clicks allocate.

3. Suggested release cities  
   Use case: Release goes to wrong cities.  
   Build: Pre-fill release dialog from indent loading location and zone filters (`release.service`, `vendor-eligibility`).

4. SLA reminders to partners  
   Use case: Placement or POD stalls.  
   Build: Extend existing `/api/cron/sla-escalate` pattern to notify vendor or client when SLA is near breach, after in-app signals exist.

### 3.4 What “now” does not include

- Client or vendor chat copilots (LLM).
- Auto-award vendor or auto-process payment.
- ML models (optional simple medians only for ETA).

---

## 4. Future scope

Add these when the simpler UI is live and you still see the pain (or enough data).

| Item | Trigger to build | Notes |
|------|------------------|-------|
| Client copilot | Tracking and invoices self-serve but same status questions repeat | LLM with read-only tools scoped to `clientId` |
| Vendor copilot | Payment breakdown live but calls continue | Same for `vendorId` |
| POD OCR / LR match | High POD rejection rate and sample data | After heuristic warnings |
| Placement nudge “agent” | In-app + SLA WhatsApp still miss deadlines | May be redundant with cron nudges |
| LLM requirement intake | Clients routinely create requirements in portal | Today most indents are staff-created |
| Onboarding document AI | KYC queue backlog after Surepass + manual | Classify docs, pre-fill; human approves |
| ML ETA | Stable 10+ completed trips per lane | Replace median with model |
| Public track link | Consignees need track without login | Signed token URL after client page is stable |
| Voice / WhatsApp placement bot | Very high indent volume | Consent, recording, quality risk |

---

## 5. Explicitly out of scope

- Marketing-site chatbot with no access to trip data.
- Autonomous indent release to vendors.
- Cross-client freight “market AI” on thin or sensitive data.
- Replacing Surepass KYC with vision-only models.

---

## 6. Suggested build order

- Sprint A: Client tracking page, scoped tracking API, list → track link, milestone notifications.
- Sprint B: Vendor action list, ranked indents, quote band, payment breakdown.
- Sprint C: Shipment Watch, ETA on tracking page, ops priority inbox, quote compare.
- Sprint D: POD upload warnings, SLA partner nudges.
- Later: Copilots, OCR, LLM intake, public track, ML ETA.

---

## 7. Security

- Portal APIs: `clientId` / `vendorId` from session only.
- Cron endpoints: protect with `CRON_SECRET` (same pattern as existing SLA cron).
- Future LLM: tool calls to existing services only; redact PAN, bank account, full phone in prompts; audit agent name and entity id, not document images.

---

## 8. Success signals

- Fewer client calls about truck location (tracking page + alerts).
- Higher quote participation on released indents (ranking + rate band).
- Lower POD rejection rate (warnings).
- Fewer vendor payment status tickets (breakdown UI).
- Shorter time from indent released to vendor allocated (quote compare + priority inbox).
