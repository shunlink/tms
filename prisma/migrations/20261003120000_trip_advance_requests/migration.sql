-- Trip-based advance request workflow (replaces unused Advance table)

DROP TABLE IF EXISTS "Advance";

CREATE TABLE "AdvanceRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SHUNLINK',
    "externalProvider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "requestedAmount" DECIMAL(65,30) NOT NULL,
    "negotiatedAmount" DECIMAL(65,30),
    "approvedAmount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "negotiatedAt" TIMESTAMP(3),
    "vendorAcceptedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "negotiatedById" TEXT,
    "approvedById" TEXT,
    "processedById" TEXT,
    "escalatedById" TEXT,
    "remarks" TEXT,
    "negotiationRemarks" TEXT,
    "processingRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvanceRequestEvent" (
    "id" TEXT NOT NULL,
    "advanceRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "amount" DECIMAL(65,30),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceRequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdvanceRequest_requestNumber_key" ON "AdvanceRequest"("requestNumber");
CREATE INDEX "AdvanceRequest_tripId_idx" ON "AdvanceRequest"("tripId");
CREATE INDEX "AdvanceRequest_vendorId_status_idx" ON "AdvanceRequest"("vendorId", "status");
CREATE INDEX "AdvanceRequest_status_idx" ON "AdvanceRequest"("status");
CREATE INDEX "AdvanceRequest_deadlineAt_idx" ON "AdvanceRequest"("deadlineAt");
CREATE INDEX "AdvanceRequest_source_status_idx" ON "AdvanceRequest"("source", "status");
CREATE INDEX "AdvanceRequestEvent_advanceRequestId_idx" ON "AdvanceRequestEvent"("advanceRequestId");
CREATE INDEX "AdvanceRequestEvent_createdAt_idx" ON "AdvanceRequestEvent"("createdAt");

ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_negotiatedById_fkey" FOREIGN KEY ("negotiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequestEvent" ADD CONSTRAINT "AdvanceRequestEvent_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequestEvent" ADD CONSTRAINT "AdvanceRequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
