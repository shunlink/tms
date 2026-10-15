-- Unified vendor payment ledger (advance + balance + manual)

ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "paymentType" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "chequeNumber" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "indentId" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "proofFileId" TEXT;
ALTER TABLE "VendorPayment" ADD COLUMN IF NOT EXISTS "recordedById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "VendorPayment_sourceId_key" ON "VendorPayment"("sourceId");
CREATE INDEX IF NOT EXISTS "VendorPayment_vendorId_paidAt_idx" ON "VendorPayment"("vendorId", "paidAt");
CREATE INDEX IF NOT EXISTS "VendorPayment_paymentType_idx" ON "VendorPayment"("paymentType");

ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_indentId_fkey"
  FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_proofFileId_fkey"
  FOREIGN KEY ("proofFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
