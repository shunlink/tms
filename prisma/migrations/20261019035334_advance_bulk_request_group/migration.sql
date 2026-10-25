-- AlterTable
ALTER TABLE "AdvanceRequest" ADD COLUMN     "bulkRequestGroupId" TEXT;

-- CreateIndex
CREATE INDEX "AdvanceRequest_bulkRequestGroupId_idx" ON "AdvanceRequest"("bulkRequestGroupId");
