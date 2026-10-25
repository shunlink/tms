# Shunlink TMS — AI Features (Agents, ML & LLM)

Document version: 2.0  
Audience: Product, leadership, investors, engineering  

Near-term (mostly automation + simple stats): see `AUTOMATION_AND_AI.md`.  
This file is the **full AI feature list** for Shunlink in **easy language**.

**Types used in tables**

- **Agent** — A focused AI worker that watches data or chats and suggests/drafts actions (human confirms money and awards by default).
- **ML** — Machine learning: learns patterns from past trips, quotes, payments (gets better as data grows).
- **LLM** — Large language model: understands questions and documents in natural language (Hindi/English).
- **Vision** — Reads photos and PDFs (POD, RC, bills).
- **Rules+** — Smart rules today; can become ML later.

---

## Plain English summary

Shunlink will feel **AI-powered** when clients can **track and predict** deliveries, vendors see **the right loads and fair rate hints**, and your team gets **help choosing vendors, catching delays, and checking bills**—all using **your own trip data**.  

AI includes **agents** (small specialists), **ML** (learning from history), **LLMs** (chat and document understanding), and **vision** (photos/POD). Humans stay in charge of **payments and final vendor award** unless a client later agrees to strict auto-rules.

---

## AI features for clients

| Feature | Type | What it does (easy) |
|---------|------|---------------------|
| Predicted arrival (ETA) | ML | Shows “likely delivery between X and Y” based on past trips on that route and live GPS. |
| Delay watch | Agent + Rules+ | Notices GPS stopped or truck sitting too long; warns client before they call you. |
| Proactive alerts | Agent | Sends WhatsApp/email: dispatched, delayed, delivered—with link to track. |
| Client copilot | LLM + Agent | Chat: “Where is my LR?”, “Unpaid invoices?” Answers only from **that client’s** shipments and bills. |
| Control tower | ML + LLM | One screen: which loads are late, cost by route, on-time %. Weekly plain-English summary. |
| “What-if” planner | LLM + ML | Ask: “If this load is 6 hours late, what else is affected?” Uses their live data. |
| Invoice explainer | LLM | Explains invoice lines in simple language (freight, detention, etc.). |
| Demand hint | ML | “You usually book about N trucks on this lane this week” (planning help). |
| Consignee track link | Rules+ | Share tracking without login (optional, later). |
| Dispute assistant | LLM | Helps client draft a short dispute note from trip + invoice facts (ops reviews). |
| Multi-language chat | LLM | Hindi/English (and more) for status questions. |
| OTIF risk score | ML | Score per shipment: likelihood of missing promised delivery window. |
| Benchmark (opt-in) | ML | Anonymous compare: your lane cost vs Shunlink network average. |

---

## AI features for vendors

| Feature | Type | What it does (easy) |
|---------|------|---------------------|
| Smart load feed | ML + Agent | Open indents sorted: best match for your zones, truck type, lanes you’ve run. |
| Quote coach | ML | Suggests rate **band** for the lane (from Shunlink history—not others’ secret bids). |
| Win chance | ML | “At ₹X your chance to win this indent is roughly Y%” (guidance only). |
| Vendor copilot | LLM + Agent | Chat: payment status, POD rejection reason, which indents to quote. |
| Payment pipeline explainer | LLM + Rules+ | Plain steps: advance paid → POD OK → balance scheduled; what’s blocking. |
| Placement nudge agent | Agent | Reminds you before deadline: vehicle/driver still missing. |
| POD quality check | Vision + Rules+ | Warns if photo blurry/dark; later reads LR number and stamp from image. |
| POD resubmit helper | LLM | Tells exactly what finance rejected and how to fix. |
| Performance coach | ML | “Your POD rejection / late placement vs network average” + tips. |
| Zone advisor | ML | Suggests which regions to add in your delivery zones for more relevant loads. |
| Cash-flow forecast | ML | Rough “when you’ll likely receive balance” from history + SLA. |
| WhatsApp quote assistant | LLM + Agent | Two-way WhatsApp: confirm quote steps, not only template buttons. |
| Voice confirm (optional) | Agent + LLM | AI call to confirm truck availability (consent + rules; later at scale). |
| Bulk advance advisor | ML | Which trips to include in bulk advance for best cash outcome. |
| Fraud shield | ML | Flags odd patterns on your account (duplicate claims, etc.). |

---

## AI features for your team (ops, finance, sales)

| Feature | Type | What it does (easy) |
|---------|------|---------------------|
| Ops priority inbox | Agent + ML | One sorted list: what to do first across placement, POD, advance, invoice. |
| Procurement assist agent | Agent + ML | Suggests which vendor to award; shows margin and reliability on that lane. |
| Release advisor agent | Agent + ML | Suggests which cities/zones to release indent to for best quote response. |
| Capacity agent | ML + Agent | Predicts where trucks will be free; best day/time to release load. |
| Execution agent | Agent + ML | Trip stuck? Suggests likely cause (long stop, route deviation, no GPS). |
| Compliance agent | Rules+ + ML | Warns: RC/DL/e-way expired or missing before dispatch. |
| Settlement agent | Agent + LLM | Compares vendor bill to trip/contract; drafts debit/credit note for finance to approve. |
| SLA predictor | ML | Predicts which advances/PODs/invoices will breach SLA **before** they do. |
| Quote outlier detector | ML | Flags bids far from lane norm (too low/high). |
| Advance anomaly detector | ML | Unusual advance vs trip rate, duplicates, repeat patterns. |
| Client credit score | ML | Risk hint from ageing, disputes, payment behavior (credit hold suggestion). |
| Vendor trust score | ML | Combines POD quality, on-time placement, quote follow-through. |
| Invoice audit AI | ML + Vision | Checks scanned vendor bills against system payables line by line. |
| Bank recon suggester | ML | Suggests which bank line matches which payment. |
| Staff copilot (ops) | LLM + Agent | Ask about indents, trips, queues—tools only, no guessing numbers. |
| Company knowledge (RAG) | LLM | Search contracts, SOPs, tariffs: “What is detention policy for Client X?” with source link. |
| Requirement intake | LLM | Paste email/WhatsApp text → draft requirement/indent for human confirm. |
| Onboarding doc AI | Vision + LLM | Reads RC/DL/GST uploads; pre-fills fields; flags mismatch with Surepass. |
| E-way / LR extract | Vision | Pulls fields from uploaded PDF/photo into indent/trip forms. |
| Bidding award analyst | ML + Agent | Compares external bidding award vs TMS margin before you confirm. |
| Auto-spot buy suggest | ML | “Contract capacity short—suggest spot procurement at ₹ band.” |
| Team routing agent | ML | Routes exception to right person (sales vs ops vs finance). |
| Daily ops briefing | LLM | Morning summary: late trips, open quotes, SLA risks in plain language. |
| Email/thread classifier | ML + LLM | Sorts inbound client email into requirement vs complaint vs document. |

---

## AI features for drivers

| Feature | Type | What it does (easy) |
|---------|------|---------------------|
| GPS nudge agent | Agent | Reminds driver to share location when pings go stale. |
| POD capture coach | Vision + Rules+ | “More light / hold steady” before upload. |
| Voice status (WhatsApp) | LLM | Driver sends voice note → structured status in TMS (local language). |
| Pool match (ShunAssist) | ML | Match certified driver to route, language, vehicle class. |
| Safety score | ML | Advisory score from telematics (harsh braking, night driving) for client reports. |
| Fatigue hint | ML + Rules+ | Long haul warning (advisory only). |
| Route deviation alert | ML | GPS path far from usual corridor → ops notified. |

---

## Network & freight intelligence (whole platform)

| Feature | Type | What it does (easy) |
|---------|------|---------------------|
| Lane DNA | ML | For each route: typical time, delay spots, busy days, toll vs non-toll behavior. |
| Buy/sell rate bands | ML | Target vendor rate and client sell rate per lane × truck type. |
| Margin guard | ML + Agent | Alerts if award would break minimum margin or client contract. |
| Demand forecast | ML | How many trucks a client/lane may need next week/month. |
| Capacity forecast | ML | Which vendors/regions will have free trucks when. |
| Indent failure risk | ML | Early warning: “may get no quotes” or “may cancel.” |
| Dynamic pricing hint | ML | Suggest sell rate when market tight on a lane. |
| Multimodal tracking fusion | ML | Combine GPS + phone network + FASTag/telematics into one best location. |
| Stoppage classifier | ML | Separates “normal rest” vs “avoidable delay” (detention, no-entry, etc.). |
| Geofence milestones | ML + Rules+ | Auto-updates timeline when truck enters load/unload area. |
| Trip risk score | ML | Weather, festival, history of theft/delay on corridor (where data exists). |
| Backhaul matcher | ML | Suggests return load for empty truck (later, network density needed). |
| Emissions estimator | ML | Approx CO₂ per trip for client ESG reports (optional). |
| Network benchmark product | ML | Anonymized lane stats for enterprise clients (opt-in). |

---

## AI agents — who they are (simple)

One **orchestrator** sends work to specialists (single chat entry in portals):

| Agent name | Type | Job in one sentence |
|------------|------|---------------------|
| Copilot orchestrator | LLM | Routes your question to the right specialist agent. |
| Client agent | LLM + Agent | Answers and scenarios for shippers using their data only. |
| Vendor agent | LLM + Agent | Loads, quotes, payments, POD help for transporters. |
| Capacity agent | ML + Agent | When and where to release indents for best truck availability. |
| Procurement agent | ML + Agent | Score quotes and suggest award + margin impact. |
| Execution agent | ML + Agent | Monitor trips; explain delays and next ops action. |
| Settlement agent | ML + LLM | Find billing mistakes; draft finance corrections. |
| Compliance agent | Rules+ + ML | Stop or warn on document/compliance gaps before trip starts. |
| Placement nudge agent | Agent | Remind vendors/clients before placement SLA slips. |
| Shipment watch agent | Agent + ML | Watch GPS; alert on stale location or long stops. |
| Voice placement agent | LLM + Agent | Optional outbound calls to vendors with summary back to TMS. |
| Knowledge agent (RAG) | LLM | Answers from internal PDFs/contracts with citations. |

---

## ML models we expect to train or host

| Model | What it learns from | Output |
|-------|---------------------|--------|
| ETA model | Past trip times + live pings | Arrival window + confidence |
| Lane rate model | Quotes, awards, trips | Fair rate band, outliers |
| Win-rate model | Historical quotes per vendor/lane | Quote win probability |
| Match / rank model | Zones, vehicle type, lane history | Ordered indents for vendor |
| Delay / stoppage model | GPS traces | Delay type and severity |
| SLA breach model | Advances, POD, invoice tasks | Risk before breach |
| Fraud / anomaly model | Payments, advances | Flags for finance review |
| Trust / credit models | Payment and behavior history | Vendor trust, client credit hint |
| Demand / capacity models | Requirements, seasons | Forecast truck counts |
| Vision OCR / classify | POD, RC, bills | Fields + pass/fail quality |
| Reconciliation match | Bank lines, payments | Suggested pairs |

Cold start: use simple averages and rules until enough trips exist per lane.

---

## What humans always control (default)

- Approve vendor payment and client billing adjustments.  
- Final vendor award on indent (AI suggests only).  
- Approve onboarding and compliance exceptions.  
- Turn on any auto-action beyond notifications.

---

## Rollout (which AI when — simple)

| When | Focus |
|------|--------|
| First | ETA (ML), shipment watch (agent), ranked loads (ML), quote band (ML), priority inbox (agent), POD warnings (vision/rules) |
| Next | Client & vendor copilots (LLM), procurement/settlement agents, document read (vision) |
| Later | Demand/capacity ML, control tower, voice, multimodal GPS fusion, governed auto-release pilots |

---

## Technical & governance (short)

Platform: agents in `src/lib/ai/`, BullMQ workers, LLM gateway with PII redaction, model registry, audit log per suggestion.  
Explain “why” on every ML/agent recommendation. India data residency for production LLM/vision where required.

---

## Other docs

- `AUTOMATION_AND_AI.md` — build first (tracking, alerts, clarity).  
- `SHUNLINK_AI_IMPLEMENTATION.md` — code hooks and APIs.  
- `AI_AUTOMATION_ROADMAP.md` — competitors and deep strategy.

Regenerate Word: `npm run docs:advanced-ai-docx` → `docs/ADVANCED_AI_FUTURE_SCOPE.docx`
