-- Trip charges (detention, deductions)
CREATE TABLE "TripCharge" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripCharge_tripId_idx" ON "TripCharge"("tripId");
CREATE INDEX "TripCharge_chargeType_idx" ON "TripCharge"("chargeType");

ALTER TABLE "TripCharge" ADD CONSTRAINT "TripCharge_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripCharge" ADD CONSTRAINT "TripCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Client payment cheque number
ALTER TABLE "ClientPayment" ADD COLUMN "chequeNumber" TEXT;

-- Vendor balance payment task extensions
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "additionalChargesAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "deductionsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "finalPayableAmount" DECIMAL(65,30);
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "voucherNumber" TEXT;
ALTER TABLE "VendorBalancePaymentTask" ADD COLUMN "voucherFileId" TEXT;

UPDATE "VendorBalancePaymentTask"
SET "finalPayableAmount" = "freightAmount" - "tdsAmount"
WHERE "finalPayableAmount" IS NULL;

ALTER TABLE "VendorBalancePaymentTask" ALTER COLUMN "finalPayableAmount" SET NOT NULL;

UPDATE "VendorBalancePaymentTask"
SET "status" = 'PENDING_REVIEW'
WHERE "status" = 'PENDING_BALANCE_PAYMENT';

ALTER TABLE "VendorBalancePaymentTask" ADD CONSTRAINT "VendorBalancePaymentTask_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorBalancePaymentTask" ADD CONSTRAINT "VendorBalancePaymentTask_voucherFileId_fkey" FOREIGN KEY ("voucherFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vendor balance payment records
CREATE TABLE "VendorBalancePayment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT,
    "utrReference" TEXT,
    "chequeNumber" TEXT,
    "remarks" TEXT,
    "proofFileId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorBalancePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VendorBalancePayment_taskId_idx" ON "VendorBalancePayment"("taskId");
CREATE INDEX "VendorBalancePayment_paidAt_idx" ON "VendorBalancePayment"("paidAt");

ALTER TABLE "VendorBalancePayment" ADD CONSTRAINT "VendorBalancePayment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "VendorBalancePaymentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorBalancePayment" ADD CONSTRAINT "VendorBalancePayment_proofFileId_fkey" FOREIGN KEY ("proofFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorBalancePayment" ADD CONSTRAINT "VendorBalancePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
