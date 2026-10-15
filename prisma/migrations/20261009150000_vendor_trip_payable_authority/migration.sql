-- Phase 1: authoritative vendor trip payable + adjustment history

CREATE TABLE "VendorTripPayable" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "indentId" TEXT,
    "freightAmount" DECIMAL(65,30) NOT NULL,
    "additionalChargesAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deductionsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tdsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "finalPayableAmount" DECIMAL(65,30) NOT NULL,
    "advanceAppliedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(65,30) NOT NULL,
    "balancePaidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "commercialApprovalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "commercialApprovedAt" TIMESTAMP(3),
    "commercialApprovedById" TEXT,
    "balancePaymentTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorTripPayable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorTripPayableAdjustment" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "previousAmounts" JSONB NOT NULL,
    "newAmounts" JSONB NOT NULL,
    "reason" TEXT,
    "tripChargeId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorTripPayableAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorTripPayable_tripId_key" ON "VendorTripPayable"("tripId");
CREATE UNIQUE INDEX "VendorTripPayable_balancePaymentTaskId_key" ON "VendorTripPayable"("balancePaymentTaskId");
CREATE INDEX "VendorTripPayable_vendorId_idx" ON "VendorTripPayable"("vendorId");
CREATE INDEX "VendorTripPayable_indentId_idx" ON "VendorTripPayable"("indentId");
CREATE INDEX "VendorTripPayable_commercialApprovalStatus_idx" ON "VendorTripPayable"("commercialApprovalStatus");
CREATE INDEX "VendorTripPayableAdjustment_payableId_createdAt_idx" ON "VendorTripPayableAdjustment"("payableId", "createdAt");

ALTER TABLE "VendorTripPayable" ADD CONSTRAINT "VendorTripPayable_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorTripPayable" ADD CONSTRAINT "VendorTripPayable_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorTripPayable" ADD CONSTRAINT "VendorTripPayable_indentId_fkey"
  FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorTripPayable" ADD CONSTRAINT "VendorTripPayable_commercialApprovedById_fkey"
  FOREIGN KEY ("commercialApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorTripPayable" ADD CONSTRAINT "VendorTripPayable_balancePaymentTaskId_fkey"
  FOREIGN KEY ("balancePaymentTaskId") REFERENCES "VendorBalancePaymentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VendorTripPayableAdjustment" ADD CONSTRAINT "VendorTripPayableAdjustment_payableId_fkey"
  FOREIGN KEY ("payableId") REFERENCES "VendorTripPayable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorTripPayableAdjustment" ADD CONSTRAINT "VendorTripPayableAdjustment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from existing balance payment tasks (idempotent on re-run)
INSERT INTO "VendorTripPayable" (
    "id",
    "tripId",
    "vendorId",
    "indentId",
    "freightAmount",
    "additionalChargesAmount",
    "deductionsAmount",
    "tdsAmount",
    "finalPayableAmount",
    "advanceAppliedAmount",
    "balanceAmount",
    "balancePaidAmount",
    "currency",
    "commercialApprovalStatus",
    "commercialApprovedAt",
    "commercialApprovedById",
    "balancePaymentTaskId",
    "createdAt",
    "updatedAt"
)
SELECT
    'vtp_' || t."id",
    t."tripId",
    t."vendorId",
    t."indentId",
    t."freightAmount",
    t."additionalChargesAmount",
    t."deductionsAmount",
    t."tdsAmount",
    t."finalPayableAmount",
    t."advanceAmount",
    t."balanceAmount",
    t."paidAmount",
    t."currency",
    CASE
        WHEN t."status" IN ('APPROVED', 'PROCESSING', 'PARTIALLY_PAID', 'PROCESSED', 'SLA_BREACHED') AND t."approvedAt" IS NOT NULL THEN 'APPROVED'
        WHEN t."status" = 'PENDING_REVIEW' THEN 'PENDING_REVIEW'
        ELSE 'DRAFT'
    END,
    t."approvedAt",
    t."approvedById",
    t."id",
    t."createdAt",
    t."updatedAt"
FROM "VendorBalancePaymentTask" t
WHERE NOT EXISTS (
    SELECT 1 FROM "VendorTripPayable" p WHERE p."tripId" = t."tripId"
);
