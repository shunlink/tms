# Shunlink TMS — AI & Automation Roadmap

**Purpose:** Investor-ready planning document grounded in the **current Shunlink TMS codebase** (October 2026). It separates what you already automate, what you can credibly ship as “AI-powered” in the near term without weakening security, and what belongs on a 12–24 month horizon.

**Audience:** Product, engineering, ops leadership, and investor conversations.

**Positioning note:** Marketing as “India’s first 4PL AI-powered logistics system” is defensible when you describe **4PL orchestration** (client + vendor + finance + compliance on one platform) plus **governed decision support and workflow automation**. Investors typically want named features, data flywheels, and human-in-the-loop controls—not generic “we use AI” claims. This document maps both.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [What the TMS already does (automation baseline)](#2-what-the-tms-already-does-automation-baseline)
3. [Security & governance model for AI](#3-security--governance-model-for-ai)
4. [Competitive landscape (India 4PL / TMS)](#4-competitive-landscape-india-4pl--tms)
5. [Opportunity map by stakeholder](#5-opportunity-map-by-stakeholder)
6. [Prioritized features — implement now (0–3 months)](#6-prioritized-features--implement-now-03-months)
7. [Medium term (3–9 months)](#7-medium-term-39-months)
8. [Future scope (9–24+ months)](#8-future-scope-924-months)
9. [Technical anchoring in the codebase](#9-technical-anchoring-in-the-codebase)
10. [Investor narrative — honest talking points](#10-investor-narrative--honest-talking-points)
11. [Metrics & proof points to track](#11-metrics--proof-points-to-track)
12. [What not to automate (security & compliance)](#12-what-not-to-automate-security--compliance)

---

## 1. Executive summary

### Current state

Shunlink TMS is a **full-stack 4PL operating system**: indents → vendor procurement (portal + WhatsApp + external bidding) → placement → trips → advances → POD → client invoicing → vendor payables → accounting subledgers. You already run **rule-based automation**, **integrations** (GST / RC / DL via Surepass), **SLA engines**, **async workers** (email, payments), and **deterministic matching** for requirements.

There is **no production LLM or classical ML model layer** in the repo today. That is an opportunity: many competitor “AI” features are **scoring + workflows + visibility** with an ML/LLM layer added where data volume justifies it.

### Recommended strategy

| Horizon | Theme | Investor message |
|--------|--------|------------------|
| **Now** | **Intelligent automation** on existing data & APIs | “AI-assisted sourcing, compliance, and exception prioritization—with every payout and allocation still approved by humans.” |
| **Next** | **ML on your trip/lane/quote history** | “Freight intelligence trained on *our* network, not generic market tables.” |
| **Later** | **Agentic execution** (calls, auto-release, auto-award) with L1–L3 autonomy | “Governed agents like Locus/Freight Tiger, scoped to Shunlink RBAC.” |

### Top 10 features (combined now + near future)

| # | Feature | Primary beneficiary | Type | Phase |
|---|---------|-------------------|------|-------|
| 1 | **Smart vendor & vehicle ranking** for indents (lane history, zones, rating, availability, historical margin) | Ops, vendors | Scoring → ML | Now |
| 2 | **Quote intelligence** — compare quotes, flag outliers vs lane benchmarks, suggest award | Ops | Rules + ML | Now |
| 3 | **Exception & work-queue prioritization** — unified “what to do next” score | Internal teams | Rules | Now |
| 4 | **Client & vendor copilots** — Q&A on *their* shipments, invoices, payments (read-only) | Client, vendor | LLM + RAG | Now |
| 5 | **POD assist** — image quality checks, optional OCR cross-check vs LR/indent | Finance, client | CV/OCR + rules | Now |
| 6 | **Proactive delay & SLA risk alerts** — ETA bands from historical TAT + live pings | Client, ops | ML-lite | 3–6 mo |
| 7 | **Onboarding document assist** — classify uploads, pre-fill KYC, highlight mismatches | Ops, partners | LLM + integrations | 3–6 mo |
| 8 | **Indent/requirement NLP capture** — turn email/WhatsApp text into structured requirement draft | Client, sales | LLM | 3–6 mo |
| 9 | **Freight rate intelligence** — lane rate bands, target buy/sell, negotiation hints | Ops, finance | ML | 6–12 mo |
| 10 | **AI-enabled placement outreach** — ranked vendor list + WhatsApp/voice nudges (opt-in) | Ops, vendors | Agents | 12+ mo |

---

## 2. What the TMS already does (automation baseline)

Use this list in investor decks as **“automation already live”** before describing new AI work.

### Operations & procurement

| Capability | What it automates | Code / module touchpoints |
|------------|-------------------|---------------------------|
| **Indent lifecycle & state machine** | Valid transitions only; audit on changes | `indent-states`, `indent.service.ts` |
| **Release to vendors by city / delivery zone** | Targeted broadcast, append-only releases | `release.service.ts`, `VendorDeliveryZone`, `delivery-zones.ts` |
| **WhatsApp indent notifications** | Template + CTA to vendor portal | `broadcast.service.ts`, `notify.ts`, `whatsapp-message.ts` |
| **Vendor quoting** | Portal quotes; inbound WhatsApp routed to portal | `quote.service.ts`, webhook `webhooks/whatsapp/quotes` |
| **Bidding integration** | Award handoff → indent | `bidding-integration.service.ts`, `/bidding-management` |
| **Manual vs bidding allocation modes** | Procurement path selection | `allocation.service.ts` |
| **Placement deadlines** | Time-boxed vendor placement | `PLACEMENT_DEADLINE_MS`, `placement.service.ts` |
| **Requirement → vendor suggestions** | Weighted score: vehicle type, lane history, rating, availability | `matchVendorsForRequirement`, `logic.scoreMatch` |
| **Trip readiness gate** | Blocks trip creation if EWB, RC, insurance, DL rules fail | `integrations/trip-readiness.ts` |

### Execution & visibility

| Capability | What it automates | Touchpoints |
|------------|-------------------|-------------|
| **Driver OTP login & indent verify** | Secure driver binding to indent lines | `otp.service.ts`, `driver.service.ts` |
| **GPS / cell tracking pings** | Location history per indent/trip | `tracking.service.ts`, `TrackingPing` |
| **Reverse geocode** | Address hints from coordinates | `geocode.ts`, `/api/geocode` |
| **POD workflow** | Upload → verification queue → approve/reject | `pod.service.ts`, `/pods` |
| **SLA tasks & escalation cron** | Advance, bad POD, invoice, balance payment SLAs | `sla.service.ts`, `sla-escalation.service.ts`, `/api/cron/sla-escalate` |
| **Important events / team routing** | Finance ops notified on POD pending, etc. | `important-event.service.ts` |

### Finance & compliance

| Capability | What it automates | Touchpoints |
|------------|-------------------|-------------|
| **Canonical work queues** | Single definition for sidebar badges & dashboards | `work-queues.service.ts` |
| **Advance approval workflow** | States, SLA breach, finance queue | `trip-advance.service.ts` |
| **Bulk advance requests (vendor portal)** | Multi-trip advance in one flow | vendor bulk advance APIs |
| **Invoicing tasks & overdue digest** | Email digests to admin | `invoice-task.service.ts`, `overdue-digest.service.ts` |
| **Payment outbox + workers** | Async payout execution | BullMQ `payment-worker.ts`, `PaymentOutbox` |
| **GST / RC / DL verification** | API-backed KYC with mock mode for dev | `integrations/gst`, `vehicle`, `dl` |
| **Accounting periods, journals, subledgers** | GL-style controls | accounting modules in schema |
| **Audit log** | Financial & admin mutations | `audit.ts`, `AuditLog` |

### Access & portals

| Capability | What it automates | Touchpoints |
|------------|-------------------|-------------|
| **RBAC + granular permissions** | 80+ permission keys, access roles | `permissions.ts`, `access-role.service.ts` |
| **Client / vendor / driver portals** | Role-separated UX | `middleware.ts`, `portal/*` |
| **Client onboarding paths** | Self-serve vs Shunlink-assisted | `client-onboarding.ts`, assisted onboarding pages |
| **Superadmin portal access** | Time-limited support view with blocked sensitive actions | `portal-access-session.service.ts` |

**Gap vs marketing:** These are **workflow automation and integrations**, not generative AI. The roadmap below adds an **intelligence layer** on top without replacing your security model.

---

## 3. Security & governance model for AI

All AI/automation features must inherit existing controls. **Do not create parallel “AI admin” bypasses.**

### Non-negotiables (aligned with current architecture)

1. **Authentication & authorization** — Every API and server action uses `authorize()` + permission keys (`src/lib/permissions.ts`). AI features only call existing services; they do not write through ad-hoc SQL.
2. **Tenant isolation** — Clients see only their trips/invoices; vendors see only their indents/quotes/payments. Copilots and RAG must filter by `clientId` / `vendorId` from the session, never from user-supplied IDs alone.
3. **Human-in-the-loop for money movement** — Keep `payment.approve`, `payment.process`, `advance.decide`, `indent.allocate` as human-gated. AI may **recommend**; it must not auto-execute outbound payments or vendor allocation without explicit policy + permission (future L2/L3 autonomy).
4. **Auditability** — Log AI recommendations and user acceptance: `audit` actions like `ai.quote_recommendation_viewed`, `ai.allocation_suggestion_accepted` with model version and input hash (no raw PII in meta).
5. **PII minimization for LLMs** — Send structured fields (lane, dates, amounts) not full PAN/bank/account numbers. Redact phone numbers in prompts; use internal IDs in tool calls.
6. **Webhook & integration security** — Keep `WHATSAPP_APP_SECRET` signature verification; API keys for bidding/cron in env only; rate-limit public and AI endpoints (`ratelimit.ts`).
7. **Data residency & vendor choice** — Prefer India-region inference or enterprise contracts (Azure OpenAI India, AWS Bedrock) for GSTIN-adjacent and commercial data.
8. **Explainability** — Surface **reason codes** (you already do this in `scoreMatch`). Investors and ops users expect “why this vendor?” not a black box.

### Suggested autonomy levels (for product design)

| Level | Name | Behavior | Example in Shunlink |
|-------|------|----------|---------------------|
| **L0** | Inform | Dashboards only | Lane rate report (exists) |
| **L1** | Recommend | Suggest; human clicks | “Award vendor X” button pre-filled |
| **L2** | Act with approval | System drafts action; one-click confirm | Draft indent from requirement text |
| **L3** | Autonomous (scoped) | Auto-act within policy caps | Auto-release to top-N vendors under ₹Y rate band — **future, policy-bound** |

Start at **L1** everywhere money, legal docs, or partner trust is involved.

---

## 4. Competitive landscape (India 4PL / TMS)

### Summary comparison

| Player | Positioning | “AI” in practice (public materials) | Relevance to Shunlink |
|--------|-------------|-------------------------------------|------------------------|
| **Freight Tiger** | AI-native TMS + marketplace + TigerSight intelligence | Exception prioritization, ETA ML, freight intelligence (lane/cost/capacity), control tower, ePOD, invoice audit | **Closest comp for enterprise shipper + 4PL story** — you need control-tower-style prioritization and lane intelligence on *your* data |
| **Locus** | Agentic TMS (enterprise delivery) | Dispatch agents, route optimization, 250+ constraints, governance (explainability, HITL, autonomy levels) | **Reference architecture for “governed agents”** — overkill for pure FTL 4PL today, but sets investor expectations |
| **BlackBuck** | Digital freight + Superloads marketplace | Load–trucker matching, toll/GPS signals, **AI outbound calling** for placement, **AI KYC** (doc verification at scale) | **Strong on procurement automation & voice** — aligns with your WhatsApp + vendor portal procurement |
| **Rivigo Relay** | Relay line-haul + booking platform | Spot pricing, tracking, scanned POD; AI mentioned in CRM context | **Client experience benchmark** — instant quote, placement assurance, POD speed |

### What clients (shippers) expect from “AI 4PL”

- **Single pane:** requirement → indent → live trip → POD → invoice status (you have this; improve **proactive** updates).
- **OTIF & ETA credibility** — not just a map pin; predicted arrival with reasons when late.
- **Exception handling** — prioritized queue, not 50 equal alerts (Freight Tiger’s control tower pattern).
- **Commercial transparency** — lane benchmarks, audit of charges (your trip profitability + reports are a foundation).

### What vendors (transporters) expect

- **Fair access to loads** — targeted releases (you have city/zone release); they want **relevant** indents first.
- **Fast advances & clear payment status** — work queues and vendor payment portal (you have); predict **when balance will pay**.
- **Low friction quoting & placement** — WhatsApp CTA + portal (you have); reduce duplicate data entry.

### Differentiation opportunity for Shunlink

Competitors optimize **their** network scale (FT 18M trips/year, BB toll graph). Your moat is **deep 4PL workflow** (client advance, vendor payables, GL, onboarding, bidding handoff) on **one Postgres truth**. AI should **tighten margin and cycle time inside that workflow**, not bolt on a generic chatbot.

---

## 5. Opportunity map by stakeholder

### 5.1 Client portal (`/portal/client`)

| Pain | Automation / AI idea | Uses existing data | Phase |
|------|---------------------|-------------------|-------|
| “Where is my truck?” | ETA widget + delay prediction; WhatsApp/email on milestone | `TrackingPing`, trip status, historical lane TAT | Medium |
| Raising requirements | NLP form fill from free text; duplicate detection | `Requirement`, client history | Medium |
| Invoice disputes | Explain invoice lines from trip charges | `ClientInvoice`, `TripCharge` | Now (rules) / LLM explain |
| Self-serve insights | “Spend by lane”, OTIF % | `reports`, trips | Now (extend dashboards) |
| Support load | **Client copilot** — “status of req #…”, “unpaid invoices” | RAG on scoped APIs | Now |

### 5.2 Vendor portal (`/portal/vendor`)

| Pain | Idea | Data | Phase |
|------|------|------|-------|
| Too many irrelevant indents | **Personalized indent feed** — score by zone, vehicle type, past lanes, win rate | `VendorDeliveryZone`, quotes, trips | Now |
| Quoting blind | Show **lane benchmark band** (anonymized) when submitting quote | `getLaneRates` | Now |
| Placement urgency | Smart reminders before placement deadline | `placement`, SLA | Now |
| Cash flow | Predict **advance eligibility** and balance payment ETA | advances, `VendorBalancePaymentTask` | Medium |
| **Vendor copilot** | “Payment status for trip X”, “why was POD rejected?” | scoped RAG | Now |

### 5.3 Internal operations

| Workflow | Idea | Phase |
|----------|------|-------|
| Indent creation | Parse client email/WhatsApp → draft indent fields for review | Medium |
| Release | Suggest cities/zones from loading point + historical winning vendors | Now |
| Quote award | Rank quotes + margin impact + vendor scorecard | Now |
| Placement queue | Prioritize cards by client tier, cut-off time, SLA risk | Now |
| POD queue | Auto-reject blurry images; OCR match LR #; route easy approvals | Now–Medium |
| Onboarding | Doc classification; GSTIN/PAN cross-check (extend Surepass) | Medium |

### 5.4 Finance & accounting

| Workflow | Idea | Phase |
|----------|------|-------|
| Invoice tasks | Auto-compose draft invoice from closed trip charges | Now |
| Payables | Anomaly detection on vendor rate vs historical lane | Medium |
| Reconciliation | Match bank lines to payments (rules → ML) | Medium |
| Credit risk | Client ageing + exposure scoring for credit hold flags | Medium |

### 5.5 Driver app (`/driver`)

| Workflow | Idea | Phase |
|----------|------|-------|
| Tracking | Background GPS; geofence arrival at load/unload | Medium |
| POD | On-device quality hints before upload | Now |
| Voice (future) | Local-language status check via WhatsApp voice note transcription | Future |

---

## 6. Prioritized features — implement now (0–3 months)

These are **shippable on the current stack** (Next.js API routes, Prisma, existing services) with minimal new infrastructure. Several can be described as **“AI-powered”** where they use statistical scoring or LLMs with strict guardrails.

### P0 — Credibility for investors (highest ROI)

#### 6.1 Intelligent Sourcing Assistant (extend existing matcher)

**What:** Unify and enhance:

- `matchVendorsForRequirement` / `scoreMatch`
- Release eligibility (`vendor-eligibility`, `VendorDeliveryZone`)
- Historical `getLaneRates` and `getVendorScorecard`
- Open indent list for vendors (reverse ranking)

**Output:** Ranked list with **explainable reasons** and a one-click “Release to top vendors” or “Suggest allocation” (L1).

**Why now:** Code and data model exist; mostly productization + richer features (distance from load city, quote win-rate, margin).

**Security:** Recommendations only; `indent.release` / `indent.allocate` unchanged.

#### 6.2 Quote Intelligence panel (indent detail)

**What:** On indent quote screen:

- Benchmark vendor rate vs lane median / p25–p75 from your trips
- Flag outliers (>2σ or >X% from benchmark)
- Suggested award with expected margin (uses `computeMargin`)

**Why now:** `getLaneRates`, `VendorQuote`, profitability services already exist.

#### 6.3 Operations “Next Best Action” queue

**What:** Single prioritized feed merging:

- `work-queues.service` counts
- Active `SlaTask` nearing breach
- `ImportantEvent` severity

**Score:** `w1*sla_urgency + w2*client_priority + w3*margin` (weights configurable).

**Why now:** No ML required; huge ops productivity win; mirrors Freight Tiger “exception prioritization.”

#### 6.4 Partner copilots (read-only, scoped)

**What:** Chat UI on client/vendor portal calling **tool-augmented** backend:

- Tools = existing GET APIs (trips, invoices, payments, indent status)
- LLM formats natural language; **never invents** numbers

**Why now:** Differentiated UX; safe if tools enforce session scope.

**Security:** No write tools in v1; log queries; rate limit; optional disable PII in prompts.

#### 6.5 POD Assist (pre-verification)

**What:** On upload:

- Image quality (blur, darkness) — client-side or server CV
- Optional OCR of LR/consignee text compare to `trip.lrNumber` / indent
- Route “high confidence” to fast-track verify queue

**Why now:** Reduces finance manual work; uses existing `pod.service` states.

**Security:** Human still uses `pod.approve`; auto-verify only for **low-risk policy** (future L2).

### P1 — Strong automation (still 0–3 months)

| Feature | Description |
|---------|-------------|
| **Smart release defaults** | When ops opens release dialog, pre-select cities from indent loading location + zone map |
| **Vendor indent notifications ranking** | Order open indents in vendor portal by fit score |
| **SLA risk badges** | Show “breach in 2h” on placement/advance/POD cards using `SlaTask.deadlineAt` |
| **Automated client status notifications** | Extend `notify.ts` for milestone templates (dispatched, delivered) — rules, not LLM |
| **Onboarding assist v2** | Highlight missing docs vs checklist; GST field already integrated in assisted onboarding |
| **Trip readiness explanations** | User-friendly expansion of `checkIndentTripReadiness` reasons on indent UI |

### P2 — Label as “ML” when you have ≥N trips per lane

| Feature | Description |
|---------|-------------|
| **Lane TAT percentiles** | Per origin–destination–vehicle type; feed ETA |
| **Vendor reliability score** | On-time placement, POD rejection rate, SLA breaches — extends scorecard |

---

## 7. Medium term (3–9 months)

### 7.1 Freight Intelligence module (client + internal)

- Lane rate curves, fuel/toll **hints** (manual or API), seasonality
- Target buy price on indent create
- **Investor story:** “Network intelligence on Shunlink’s own trip graph.”

**Depends on:** Clean historical trip data; privacy when showing benchmarks to vendors (aggregated/anonymized).

### 7.2 ETA & exception prediction

- Features: distance, vehicle type, time of day, historical stops, latest ping velocity
- Model: gradient boosting or simple regression first; upgrade with more data
- Integrate: client portal, WhatsApp proactive messages

**Comp reference:** Freight Tiger ETA engine; FT case study on avoidable stoppages.

### 7.3 NLP intake channel

- Ingest email/WhatsApp forwarded requirements → `Requirement` / draft `Indent`
- Human approval before create (`indent.create`)

### 7.4 Document AI for onboarding & compliance

- Classify RC/DL/insurance/policy PDFs
- Extract expiry dates → `VehicleCompliance`
- Pair with Surepass verification (human trusts API + AI extraction cross-check)

**Comp reference:** BlackBuck KYC desk automation narrative.

### 7.5 Invoice & freight audit

- Match invoice lines to trip charges; flag discrepancies
- Suggest debit/credit notes

**Comp reference:** Freight Tiger invoice audit.

### 7.6 Bidding + TMS joint optimization

- When `allocationMode: BIDDING`, use award handoff data to **retrain** lane benchmarks
- Show unified procurement analytics in `/bidding-management`

---

## 8. Future scope (9–24+ months)

| Capability | Description | Autonomy | Dependencies |
|------------|-------------|----------|--------------|
| **Voice / WhatsApp placement agents** | Outbound calls or WA flows to top-N vendors for confirmation | L2–L3 with caps | Telecom provider, consent registry, call recording policy |
| **Multi-source tracking fusion** | GPS + SIM + FASTag-style signals | L1 alerts | Telematics partners, driver app adoption |
| **Autonomous release & award** | Policy: “if margin > X and vendor score > Y, auto-award” | L3 | Legal, client contracts, simulation sandbox |
| **ShunAssist driver pool matching** | Certified pool assignment by route, language, rating | L1–L2 | ShunAssist integration (planned in architecture docs) |
| **Control tower for enterprise clients** | Client-specific SLA rules, multi-plant views | L1 | Multi-tenant config UI |
| **Agentic finance** | Auto-draft journals from payments (still post by accountant) | L2 | Accounting policy sign-off |
| **Cross-client network insights** | Anonymized benchmarking (opt-in) | L0 | Data governance board |

---

## 9. Technical anchoring in the codebase

Suggested **implementation pattern** (keeps security intact):

```
Portal / Dashboard UI
    → /api/ai/*  (new, rate-limited, authorize())
        → intelligence.service.ts  (pure scoring)
        → copilot.service.ts     (LLM orchestration, tools only)
        → existing domain services (indent, quote, pod, trip-advance, …)
        → prisma (scoped queries)
        → audit.log
```

### Existing modules to extend (do not fork logic)

| Domain | Service / lib | AI/automation hook |
|--------|---------------|-------------------|
| Matching | `logic.scoreMatch`, `queries.matchVendorsForRequirement` | Feature expansion + ML export |
| Release | `release.service.ts` | Suggested cities/vendors |
| Quotes | `quote.service.ts` | Benchmark + recommend award |
| SLA | `sla.service.ts`, cron routes | Risk scoring |
| POD | `pod.service.ts` | Pre-verify assist |
| Reports | `queries.getLaneRates`, `getVendorScorecard` | Intelligence APIs |
| Notify | `notify.ts`, `broadcast.service.ts` | Proactive milestones |
| Integrations | `integrations/*` | Doc AI + verification |
| Permissions | `permission.service.ts` | New keys: `ai.copilot.use`, `ai.insights.view` |

### Infrastructure additions (minimal)

| Component | Purpose |
|-----------|---------|
| `AI_PROVIDER` env | OpenAI / Azure / Bedrock abstraction |
| Redis | Cache lane stats & copilot session context |
| Optional: vector store | Embeddings for doc search (onboarding) — **not required for v1 copilot** if using tool calling only |
| Background jobs | Recompute lane aggregates nightly (cron or BullMQ) |

### Testing

- Unit tests for scoring (extend `logic.test.ts` pattern)
- Golden tests for copilot tools (mock LLM)
- Permission tests: vendor A cannot query client B trip via copilot tools

---

## 10. Investor narrative — honest talking points

### What you can say today (truthful)

- “We operate a **unified 4PL platform**: client requirements, indent procurement, vendor portal, WhatsApp distribution, placement, advances, POD, billing, and vendor payouts with **audit and RBAC**.”
- “We already **automate procurement outreach** (WhatsApp templates), **compliance gates** (GST/RC/DL APIs), **SLA escalation**, and **deterministic vendor–vehicle matching** with explainable scores.”
- “Our AI roadmap adds **decision intelligence and copilots** on that same workflow—not a separate chat app.”

### What to say after P0 ships (3 months)

- “**Intelligent Sourcing Assistant** ranks vendors and vehicles using lane history, availability, and commercial margin.”
- “**Quote Intelligence** benchmarks every bid against our lane database.”
- “**Client and vendor copilots** answer status questions from live data with zero cross-tenant leakage.”
- “**POD Assist** cuts finance verification time using image and document checks—humans remain approvers.”

### What not to claim

- “Fully autonomous 4PL with no humans” — false for Indian contract freight and your payment controls.
- “Generic ChatGPT integration” — investors want **workflow-embedded** intelligence.
- “Real-time nationwide freight index” — until you have volume; say “**Shunlink network benchmarks**.”

### 4PL + AI framing

**4PL** = you orchestrate carriers, clients, compliance, and money flow (your product).  
**AI** = prioritization, prediction, extraction, and recommendations **inside** that orchestration—with governance.

---

## 11. Metrics & proof points to track

| Metric | Baseline | Target (post-P0) |
|--------|----------|------------------|
| Median time: indent created → vendor allocated | Measure from `AuditLog` | −20% |
| Quote-to-award cycle time | `VendorQuote` timestamps | −15% |
| Ops touches per indent | Manual edits / reassignments | −25% |
| POD verification time | `POD_PENDING` → verified | −30% |
| SLA breach rate | `SlaTask` BREACHED | −10% |
| Client portal support tickets / WA msgs | Support log | −20% |
| Vendor quote participation rate | Quotes / releases | +15% |
| **AI feature adoption** | Copilot sessions, suggestions accepted | Report monthly |

Store aggregate metrics in DB or BI; tie **accepted AI suggestions** to audit events for diligence.

---

## 12. What not to automate (security & compliance)

| Area | Rule |
|------|------|
| **Outbound payments** | Never auto-fire without `payment.approve` + limits |
| **Vendor allocation / award** | L3 only with signed client policy; default L1 |
| **POD legal acceptance** | Finance sign-off remains unless explicit client contract allows auto-accept |
| **GST / tax reporting** | AI may draft; accountant posts journals |
| **Cross-tenant data** | No training on client A data to benefit client B without consent |
| **Driver PII** | DL/Aadhaar images not sent to public LLMs without DPA |
| **Superadmin / master OTP** | Never automate bypass |
| **Webhook endpoints** | Never expose internal AI tools without auth |

---

## Appendix A — Module × automation matrix (full TMS)

| Module | Route / area | Automation today | AI near-term | AI future |
|--------|--------------|------------------|--------------|-----------|
| Dashboard | `/` | KPIs, work queues | Next-best-action score | Predictive KPI alerts |
| Indents | `/indents` | State machine, release, allocate | Quote intel, NLP draft | Auto-release policies |
| Placement | `/placement` | Deadlines, vendor assign | Priority queue | Geofence auto status |
| Requirements | `/requirements` | Auto-match vendors | NLP create | Demand forecast |
| Trips | `/trips` | Status actions, charges | ETA | Route risk |
| Tracking | APIs | Pings, geocode | Delay prediction | Multi-source fusion |
| POD | `/pods` | Queue, SLA | POD assist OCR | Auto-approve low risk |
| Advances | dashboards | SLA, approval | Fraud/anomaly flags | — |
| Invoices | `/invoices` | Tasks, print | Draft from trips | Audit vs contract |
| Payments | `/payments` | Outbox worker | Anomaly detection | — |
| Accounting | `/accounting/*` | Period close rules | Suggest matches | Auto-draft entries |
| Onboarding | `/onboarding`, portals | Workflows, GST API | Doc AI | Risk scoring |
| Access roles | `/access-roles` | RBAC | — | — |
| Bidding | `/bidding-management` | Integration | Benchmark sync | Auto spot buy |
| Client portal | `/portal/client` | Trips, reqs | Copilot, ETA | Control tower |
| Vendor portal | `/portal/vendor` | Indents, bulk advance | Ranked feed, copilot | Voice placement |
| Driver | `/driver` | OTP, POD upload | Capture hints | Voice status |
| Notifications | `/notifications` | WhatsApp outbox | Smart templates | Agent outreach |
| Reports | `/reports` | Lane rates, scorecard | Intelligence hub | Network benchmarks |
| Audit | `/audit` | Immutable log | AI action logging | — |

---

## Appendix B — Suggested engineering epics (Jira-ready)

1. **EPIC: Sourcing Intelligence v1** — scoring service, indent UI, vendor feed ranking  
2. **EPIC: Quote Intelligence** — benchmark API, indent quotes panel  
3. **EPIC: Ops Priority Queue** — unified scoring over work-queues + SLA  
4. **EPIC: Partner Copilot v1** — tool routes, client/vendor UI, audit  
5. **EPIC: POD Assist** — quality + OCR pipeline, finance fast-lane  
6. **EPIC: Lane aggregates job** — nightly cron, `LaneStat` table (new)  
7. **EPIC: AI governance** — permissions, logging, redaction, feature flags  

---

## Document control

| Field | Value |
|-------|--------|
| Version | 1.0 |
| Based on | TMS repo analysis + public competitor materials (Freight Tiger, Locus, BlackBuck, Rivigo) |
| Next review | After P0 epic completion or quarterly |

*This is a planning document. Implementation estimates depend on team size and data quality; prioritize P0 items that reuse `scoreMatch`, lane reports, SLA, and portal APIs for the fastest credible “AI in production” story.*
