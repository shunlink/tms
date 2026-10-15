# TMS Architecture (Current)

## Overview

Transport Management System for indent → placement → trip → POD → finance workflows.

```mermaid
flowchart TB
  subgraph Upload["POD Upload"]
    F[Front Image] --> API["POST /api/trips/:id/documents"]
    B[Back Image] --> API
    API --> PS[pod.service.ts]
    PS --> DB[(IndentPod\nfileId + backFileId)]
    DB -->|both present| Q[PENDING_VERIFICATION]
  end

  subgraph Transit["Trip Start IN_TRANSIT"]
    VR[Vendor submits advance request] --> AR[(AdvanceRequest)]
    AR --> TG{Live request exists?}
    TG -->|yes| IT[IN_TRANSIT allowed]
    TG -->|no| BL[Blocked]
  end

  subgraph PODVerify["POD Verification — Finance"]
    Q --> PQ["/pods in Finance nav"]
    PQ --> FIN[Super Admin / Admin / Finance]
    FIN -->|verify| VER[VERIFIED → Invoice + Balance tasks]
  end

  subgraph Email["Async Email — Resend"]
    EVT[SLA breach / Alerts / Cron digest] --> ENQ[BullMQ tms-email-notifications]
    ENQ --> WRK[npm run worker:email]
    WRK --> RS[Resend API]
    RS --> ADM[Admin + Super Admin inbox]
    CRON["POST /api/cron/overdue-digest"] --> DIG[Combined overdue digest]
    DIG --> ENQ
  end

  subgraph AdvanceCap["Advance Validation"]
    REQ[requestedAmount] --> CAP{"≤ vendorRate × 85%"}
    CAP -->|pass| AR
    CAP -->|fail| ERR[Rejected + toast]
  end
```

## Key domains

| Domain | Service | Notes |
|--------|---------|-------|
| POD | `pod.service.ts` | Dual image required; Finance verifies |
| Advance | `trip-advance.service.ts` | 85% vendorRate cap; request-only gate for transit |
| Email | `notify.ts`, `email/resend.ts` | BullMQ queue + worker |
| SLA | `sla-escalation.service.ts` | 24h tasks; digest via cron |

## Roles & POD access

| Role | POD upload | POD verify |
|------|------------|------------|
| Vendor / Driver | Yes | No |
| Operations | Yes | No |
| Finance | No | Yes |
| Admin / Super Admin | Yes | Yes |

## Workers & cron

| Command / endpoint | Purpose |
|--------------------|---------|
| `npm run worker:email` | Process BullMQ email jobs via Resend |
| `POST /api/cron/sla-escalate` | Escalate overdue SLA tasks |
| `POST /api/cron/overdue-digest` | Daily combined overdue email to Admin/Super Admin |
