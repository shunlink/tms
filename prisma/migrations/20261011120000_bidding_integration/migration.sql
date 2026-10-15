-- Bidding ↔ TMS integration: party links, indent external ids, handoff idempotency

ALTER TABLE "Client" ADD COLUMN "biddingCompanyId" TEXT;
ALTER TABLE "Client" ADD COLUMN "biddingApplicationId" TEXT;
CREATE UNIQUE INDEX "Client_biddingCompanyId_key" ON "Client"("biddingCompanyId");
CREATE UNIQUE INDEX "Client_biddingApplicationId_key" ON "Client"("biddingApplicationId");

ALTER TABLE "Vendor" ADD COLUMN "biddingCompanyId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "biddingApplicationId" TEXT;
CREATE UNIQUE INDEX "Vendor_biddingCompanyId_key" ON "Vendor"("biddingCompanyId");
CREATE UNIQUE INDEX "Vendor_biddingApplicationId_key" ON "Vendor"("biddingApplicationId");

ALTER TABLE "Indent" ADD COLUMN "biddingLoadRequirementId" TEXT;
ALTER TABLE "Indent" ADD COLUMN "biddingBidId" TEXT;
ALTER TABLE "Indent" ADD COLUMN "biddingBidAcceptanceId" TEXT;
ALTER TABLE "Indent" ADD COLUMN "biddingHandoffKey" TEXT;
CREATE UNIQUE INDEX "Indent_biddingLoadRequirementId_key" ON "Indent"("biddingLoadRequirementId");
CREATE UNIQUE INDEX "Indent_biddingHandoffKey_key" ON "Indent"("biddingHandoffKey");
CREATE INDEX "Indent_biddingBidId_idx" ON "Indent"("biddingBidId");

CREATE TABLE "BiddingIntegrationHandoff" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "indentId" TEXT,
    "tripId" TEXT,
    "tmsPartyId" TEXT,
    "partyType" TEXT,
    "payloadHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiddingIntegrationHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BiddingIntegrationHandoff_idempotencyKey_key" ON "BiddingIntegrationHandoff"("idempotencyKey");
