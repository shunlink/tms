-- Advance payment details and voucher storage on trip advance requests
ALTER TABLE "AdvanceRequest" ADD COLUMN "paidAmount" DECIMAL(65,30);
ALTER TABLE "AdvanceRequest" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "AdvanceRequest" ADD COLUMN "paymentDate" TIMESTAMP(3);
ALTER TABLE "AdvanceRequest" ADD COLUMN "utrReference" TEXT;
ALTER TABLE "AdvanceRequest" ADD COLUMN "bankAccountUsed" TEXT;
ALTER TABLE "AdvanceRequest" ADD COLUMN "paymentProofFileId" TEXT;
ALTER TABLE "AdvanceRequest" ADD COLUMN "voucherNumber" TEXT;
ALTER TABLE "AdvanceRequest" ADD COLUMN "voucherFileId" TEXT;
ALTER TABLE "AdvanceRequest" ADD COLUMN "voucherGeneratedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AdvanceRequest_voucherNumber_key" ON "AdvanceRequest"("voucherNumber");
CREATE INDEX "AdvanceRequest_voucherNumber_idx" ON "AdvanceRequest"("voucherNumber");

ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_paymentProofFileId_fkey" FOREIGN KEY ("paymentProofFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvanceRequest" ADD CONSTRAINT "AdvanceRequest_voucherFileId_fkey" FOREIGN KEY ("voucherFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
