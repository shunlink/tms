-- POD verification workflow: extend IndentPod with verification, rejection, SLA, and history fields.

ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "tripId" TEXT;
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "resolutionStatus" TEXT;
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "slaDeadlineAt" TIMESTAMP(3);
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3);
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "IndentPod" ADD COLUMN IF NOT EXISTS "previousPodId" TEXT;

-- Migrate legacy status values
UPDATE "IndentPod" SET "status" = 'PENDING_VERIFICATION' WHERE "status" = 'PENDING';
UPDATE "IndentPod" SET "status" = 'VERIFIED' WHERE "status" = 'APPROVED';
UPDATE "IndentPod" SET "status" = 'BAD_POD' WHERE "status" = 'REJECTED';

-- Indexes
CREATE INDEX IF NOT EXISTS "IndentPod_status_idx" ON "IndentPod"("status");
CREATE INDEX IF NOT EXISTS "IndentPod_tripId_idx" ON "IndentPod"("tripId");
CREATE INDEX IF NOT EXISTS "IndentPod_resolutionStatus_idx" ON "IndentPod"("resolutionStatus");

-- Foreign keys
ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_previousPodId_fkey" FOREIGN KEY ("previousPodId") REFERENCES "IndentPod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
