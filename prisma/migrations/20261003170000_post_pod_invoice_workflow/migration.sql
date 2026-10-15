-- Post-POD invoice workflow: trip closure on POD verify, invoice tasks, billing snapshots

-- Trip closure fields (set only when POD is verified)
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "podVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "podVerifiedById" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "tripClosedAt" TIMESTAMP(3);

ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_podVerifiedById_fkey"
  FOREIGN KEY ("podVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ClientInvoice billing snapshot + audit fields
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "billingName" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "billingGstin" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "billingAddress" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "billingEmail" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER;

ALTER TABLE "ClientInvoice"
  ADD CONSTRAINT "ClientInvoice_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ClientInvoiceLine trip/indent snapshot fields
ALTER TABLE "ClientInvoiceLine" ADD COLUMN IF NOT EXISTS "lrNumber" TEXT;
ALTER TABLE "ClientInvoiceLine" ADD COLUMN IF NOT EXISTS "routeFrom" TEXT;
ALTER TABLE "ClientInvoiceLine" ADD COLUMN IF NOT EXISTS "routeTo" TEXT;
ALTER TABLE "ClientInvoiceLine" ADD COLUMN IF NOT EXISTS "cargoSummary" TEXT;
ALTER TABLE "ClientInvoiceLine" ADD COLUMN IF NOT EXISTS "vehicleReg" TEXT;
ALTER TABLE "ClientInvoiceLine" ADD COLUMN IF NOT EXISTS "indentNumber" TEXT;

-- Invoice task queue for finance
CREATE TABLE IF NOT EXISTS "InvoiceTask" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "indentId" TEXT,
  "clientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "podVerifiedAt" TIMESTAMP(3) NOT NULL,
  "deadlineAt" TIMESTAMP(3) NOT NULL,
  "slaBreachedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceTask_tripId_key" ON "InvoiceTask"("tripId");
CREATE INDEX IF NOT EXISTS "InvoiceTask_status_idx" ON "InvoiceTask"("status");
CREATE INDEX IF NOT EXISTS "InvoiceTask_deadlineAt_idx" ON "InvoiceTask"("deadlineAt");
CREATE INDEX IF NOT EXISTS "InvoiceTask_clientId_idx" ON "InvoiceTask"("clientId");

ALTER TABLE "InvoiceTask"
  ADD CONSTRAINT "InvoiceTask_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceTask"
  ADD CONSTRAINT "InvoiceTask_indentId_fkey"
  FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceTask"
  ADD CONSTRAINT "InvoiceTask_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceTask"
  ADD CONSTRAINT "InvoiceTask_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: trips with verified POD → CLOSED with closure timestamps
UPDATE "Trip" t
SET
  "status" = 'CLOSED',
  "podVerifiedAt" = COALESCE(t."podVerifiedAt", t."podReceivedAt", p."verifiedAt"),
  "tripClosedAt" = COALESCE(t."tripClosedAt", t."podReceivedAt", p."verifiedAt"),
  "podReceivedAt" = COALESCE(t."podReceivedAt", p."verifiedAt")
FROM "IndentPod" p
WHERE p."tripId" = t.id
  AND p.status = 'VERIFIED'
  AND t.status IN ('POD_RECEIVED', 'DELIVERED');

-- Backfill invoice tasks for closed trips without invoices
INSERT INTO "InvoiceTask" ("id", "tripId", "indentId", "clientId", "status", "podVerifiedAt", "deadlineAt", "createdAt")
SELECT
  'invtask_' || t.id,
  t.id,
  t."indentId",
  t."clientId",
  'PENDING',
  COALESCE(t."podVerifiedAt", t."tripClosedAt", NOW()),
  COALESCE(t."podVerifiedAt", t."tripClosedAt", NOW()) + INTERVAL '24 hours',
  NOW()
FROM "Trip" t
WHERE t.status = 'CLOSED'
  AND NOT EXISTS (SELECT 1 FROM "ClientInvoiceLine" l WHERE l."tripId" = t.id)
  AND NOT EXISTS (SELECT 1 FROM "InvoiceTask" it WHERE it."tripId" = t.id);
