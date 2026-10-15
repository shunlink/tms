-- Post-POD vendor balance payment workflow (96h SLA from POD verification)

CREATE TABLE IF NOT EXISTS "VendorBalancePaymentTask" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "indentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_BALANCE_PAYMENT',
  "freightAmount" DECIMAL(65,30) NOT NULL,
  "advanceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "tdsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "balanceAmount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "podVerifiedAt" TIMESTAMP(3) NOT NULL,
  "deadlineAt" TIMESTAMP(3) NOT NULL,
  "slaBreachedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "paymentMode" TEXT,
  "paymentDetails" TEXT,
  "processingRemarks" TEXT,
  "processedAt" TIMESTAMP(3),
  "processedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorBalancePaymentTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VendorBalancePaymentTask_tripId_key" ON "VendorBalancePaymentTask"("tripId");
CREATE INDEX IF NOT EXISTS "VendorBalancePaymentTask_status_idx" ON "VendorBalancePaymentTask"("status");
CREATE INDEX IF NOT EXISTS "VendorBalancePaymentTask_deadlineAt_idx" ON "VendorBalancePaymentTask"("deadlineAt");
CREATE INDEX IF NOT EXISTS "VendorBalancePaymentTask_vendorId_idx" ON "VendorBalancePaymentTask"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorBalancePaymentTask_indentId_idx" ON "VendorBalancePaymentTask"("indentId");

ALTER TABLE "VendorBalancePaymentTask"
  ADD CONSTRAINT "VendorBalancePaymentTask_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorBalancePaymentTask"
  ADD CONSTRAINT "VendorBalancePaymentTask_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorBalancePaymentTask"
  ADD CONSTRAINT "VendorBalancePaymentTask_indentId_fkey"
  FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorBalancePaymentTask"
  ADD CONSTRAINT "VendorBalancePaymentTask_processedById_fkey"
  FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "VendorBalancePaymentEvent" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "amount" DECIMAL(65,30),
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorBalancePaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VendorBalancePaymentEvent_taskId_idx" ON "VendorBalancePaymentEvent"("taskId");
CREATE INDEX IF NOT EXISTS "VendorBalancePaymentEvent_createdAt_idx" ON "VendorBalancePaymentEvent"("createdAt");

ALTER TABLE "VendorBalancePaymentEvent"
  ADD CONSTRAINT "VendorBalancePaymentEvent_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "VendorBalancePaymentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorBalancePaymentEvent"
  ADD CONSTRAINT "VendorBalancePaymentEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
