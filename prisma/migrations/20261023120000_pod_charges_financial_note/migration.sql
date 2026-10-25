-- Trip client loading/unloading charges at POD verify
ALTER TABLE "Trip" ADD COLUMN "clientLoadingCharge" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Trip" ADD COLUMN "clientUnloadingCharge" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Financial note link to bad POD + deduction reason
ALTER TABLE "FinancialNote" ADD COLUMN "indentPodId" TEXT;
ALTER TABLE "FinancialNote" ADD COLUMN "vendorDeductionReason" TEXT;

CREATE INDEX "FinancialNote_indentPodId_idx" ON "FinancialNote"("indentPodId");

ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_indentPodId_fkey" FOREIGN KEY ("indentPodId") REFERENCES "IndentPod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invoice lines: freight + loading + unloading per trip
ALTER TABLE "ClientInvoiceLine" ADD COLUMN "lineKind" TEXT NOT NULL DEFAULT 'FREIGHT';

DROP INDEX IF EXISTS "ClientInvoiceLine_invoiceId_tripId_key";

CREATE UNIQUE INDEX "ClientInvoiceLine_invoiceId_tripId_lineKind_key" ON "ClientInvoiceLine"("invoiceId", "tripId", "lineKind");
