-- Client payment records and external vendor advance finance fields

CREATE TABLE IF NOT EXISTS "ClientPayment" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "paymentType" TEXT NOT NULL DEFAULT 'PAYMENT',
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "paymentMode" TEXT,
  "referenceNo" TEXT,
  "notes" TEXT,
  "invoiceId" TEXT,
  "indentId" TEXT,
  "tripId" TEXT,
  "proofFileId" TEXT,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientPayment_clientId_paidAt_idx" ON "ClientPayment"("clientId", "paidAt");
CREATE INDEX IF NOT EXISTS "ClientPayment_invoiceId_idx" ON "ClientPayment"("invoiceId");
CREATE INDEX IF NOT EXISTS "ClientPayment_indentId_idx" ON "ClientPayment"("indentId");
CREATE INDEX IF NOT EXISTS "ClientPayment_tripId_idx" ON "ClientPayment"("tripId");

ALTER TABLE "ClientPayment"
  ADD CONSTRAINT "ClientPayment_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientPayment"
  ADD CONSTRAINT "ClientPayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPayment"
  ADD CONSTRAINT "ClientPayment_indentId_fkey"
  FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPayment"
  ADD CONSTRAINT "ClientPayment_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPayment"
  ADD CONSTRAINT "ClientPayment_proofFileId_fkey"
  FOREIGN KEY ("proofFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPayment"
  ADD CONSTRAINT "ClientPayment_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdvanceRequest" ADD COLUMN IF NOT EXISTS "externalReference" TEXT;
