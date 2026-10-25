ALTER TABLE "Client" ADD COLUMN "businessType" TEXT;
ALTER TABLE "Client" ADD COLUMN "onboardingPreference" TEXT;

ALTER TABLE "OnboardingCase" ADD COLUMN "submittedById" TEXT;

CREATE INDEX "OnboardingCase_entityType_status_idx" ON "OnboardingCase"("entityType", "status");

ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
