-- Client dynamic onboarding: assignment, SLA escalation, signed agreement URL

ALTER TABLE "OnboardingCase" ADD COLUMN "assignedEmployeeId" TEXT;
ALTER TABLE "OnboardingCase" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "OnboardingCase" ADD COLUMN "isSlaEscalated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnboardingCase" ADD COLUMN "agreementUrl" TEXT;

CREATE INDEX "OnboardingCase_assignedEmployeeId_idx" ON "OnboardingCase"("assignedEmployeeId");
CREATE INDEX "OnboardingCase_entityType_status_isSlaEscalated_idx" ON "OnboardingCase"("entityType", "status", "isSlaEscalated");

ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Map legacy client onboarding statuses to the new workflow (idempotent for re-runs on empty sets)
UPDATE "OnboardingCase"
SET "status" = 'PARTIAL_SUBMISSION'
WHERE "entityType" = 'CLIENT' AND "status" = 'PENDING_OPS_ONBOARDING';

UPDATE "OnboardingCase"
SET "status" = 'PENDING_APPROVAL'
WHERE "entityType" = 'CLIENT' AND "status" = 'SUBMITTED';
