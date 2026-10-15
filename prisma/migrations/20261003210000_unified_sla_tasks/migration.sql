-- Unified SLA task registry (single escalation evaluator)
CREATE TABLE "SlaTask" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tripId" TEXT,
    "indentId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "breachedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "importantEventId" TEXT,
    "targetTeamCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlaTask_entity_entityId_key" ON "SlaTask"("entity", "entityId");
CREATE INDEX "SlaTask_status_deadlineAt_idx" ON "SlaTask"("status", "deadlineAt");
CREATE INDEX "SlaTask_type_status_idx" ON "SlaTask"("type", "status");
CREATE INDEX "SlaTask_tripId_idx" ON "SlaTask"("tripId");
CREATE INDEX "SlaTask_indentId_idx" ON "SlaTask"("indentId");

-- Backfill from existing domain SLA fields
INSERT INTO "SlaTask" ("id", "type", "entity", "entityId", "tripId", "indentId", "startAt", "deadlineAt", "status", "breachedAt", "resolvedAt", "escalatedAt", "targetTeamCode", "createdAt", "updatedAt")
SELECT
  'sla_adv_' || ar."id",
  'ADVANCE_REQUEST',
  'AdvanceRequest',
  ar."id",
  ar."tripId",
  NULL,
  ar."requestedAt",
  ar."deadlineAt",
  CASE
    WHEN ar."status" IN ('PROCESSED', 'REJECTED', 'CANCELLED', 'EXTERNAL') THEN 'RESOLVED'
    WHEN ar."status" = 'SLA_BREACHED' THEN 'BREACHED'
    ELSE 'ACTIVE'
  END,
  CASE WHEN ar."status" = 'SLA_BREACHED' THEN ar."escalatedAt" ELSE NULL END,
  CASE WHEN ar."status" IN ('PROCESSED', 'REJECTED', 'CANCELLED') THEN COALESCE(ar."processedAt", ar."approvedAt", ar."requestedAt") ELSE NULL END,
  ar."escalatedAt",
  'FINANCE',
  ar."createdAt",
  NOW()
FROM "AdvanceRequest" ar
WHERE ar."source" = 'SHUNLINK'
ON CONFLICT ("entity", "entityId") DO NOTHING;

INSERT INTO "SlaTask" ("id", "type", "entity", "entityId", "tripId", "indentId", "startAt", "deadlineAt", "status", "breachedAt", "resolvedAt", "escalatedAt", "targetTeamCode", "createdAt", "updatedAt")
SELECT
  'sla_pod_' || p."id",
  'BAD_POD',
  'IndentPod',
  p."id",
  p."tripId",
  p."indentId",
  COALESCE(p."rejectedAt", p."uploadedAt"),
  p."slaDeadlineAt",
  CASE
    WHEN p."resolutionStatus" = 'CORRECTED' OR p."status" = 'VERIFIED' THEN 'RESOLVED'
    WHEN p."resolutionStatus" = 'SLA_BREACHED' THEN 'BREACHED'
    WHEN p."status" = 'BAD_POD' THEN 'ACTIVE'
    ELSE 'CANCELLED'
  END,
  p."slaBreachedAt",
  CASE WHEN p."resolutionStatus" = 'CORRECTED' OR p."status" = 'VERIFIED' THEN p."verifiedAt" ELSE NULL END,
  p."escalatedAt",
  'OPERATIONS',
  p."uploadedAt",
  NOW()
FROM "IndentPod" p
WHERE p."status" = 'BAD_POD' OR p."resolutionStatus" IS NOT NULL
ON CONFLICT ("entity", "entityId") DO NOTHING;

INSERT INTO "SlaTask" ("id", "type", "entity", "entityId", "tripId", "indentId", "startAt", "deadlineAt", "status", "breachedAt", "resolvedAt", "escalatedAt", "targetTeamCode", "createdAt", "updatedAt")
SELECT
  'sla_inv_' || it."id",
  'INVOICE',
  'InvoiceTask',
  it."id",
  it."tripId",
  it."indentId",
  it."podVerifiedAt",
  it."deadlineAt",
  CASE
    WHEN it."status" = 'COMPLETED' THEN 'RESOLVED'
    WHEN it."status" = 'SLA_BREACHED' THEN 'BREACHED'
    ELSE 'ACTIVE'
  END,
  it."slaBreachedAt",
  CASE WHEN it."status" = 'COMPLETED' THEN it."createdAt" ELSE NULL END,
  it."escalatedAt",
  'FINANCE',
  it."createdAt",
  NOW()
FROM "InvoiceTask" it
ON CONFLICT ("entity", "entityId") DO NOTHING;

INSERT INTO "SlaTask" ("id", "type", "entity", "entityId", "tripId", "indentId", "startAt", "deadlineAt", "status", "breachedAt", "resolvedAt", "escalatedAt", "targetTeamCode", "createdAt", "updatedAt")
SELECT
  'sla_bal_' || bt."id",
  'BALANCE_PAYMENT',
  'VendorBalancePaymentTask',
  bt."id",
  bt."tripId",
  bt."indentId",
  bt."podVerifiedAt",
  bt."deadlineAt",
  CASE
    WHEN bt."status" = 'PROCESSED' THEN 'RESOLVED'
    WHEN bt."status" = 'SLA_BREACHED' THEN 'BREACHED'
    ELSE 'ACTIVE'
  END,
  bt."slaBreachedAt",
  bt."processedAt",
  bt."escalatedAt",
  'FINANCE',
  bt."createdAt",
  NOW()
FROM "VendorBalancePaymentTask" bt
ON CONFLICT ("entity", "entityId") DO NOTHING;
