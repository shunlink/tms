-- Phase 4: Formal debit/credit notes

CREATE TABLE "FinancialNote" (
    "id" TEXT NOT NULL,
    "noteNumber" TEXT,
    "noteType" TEXT NOT NULL,
    "issuerEntity" TEXT NOT NULL DEFAULT 'SHUNLINK',
    "counterpartyType" TEXT NOT NULL,
    "vendorId" TEXT,
    "clientId" TEXT,
    "indentId" TEXT,
    "tripId" TEXT,
    "clientInvoiceId" TEXT,
    "tripChargeId" TEXT,
    "issueDate" TIMESTAMP(3),
    "accountingDate" DATE,
    "reason" TEXT,
    "description" TEXT,
    "businessPurpose" TEXT NOT NULL,
    "payableEffect" TEXT NOT NULL DEFAULT 'APPLY_TO_SUBLEDGER',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "taxableAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxJurisdiction" TEXT,
    "taxMeta" JSONB,
    "documentFileId" TEXT,
    "issuedJournalId" TEXT,
    "reversalJournalId" TEXT,
    "reversesNoteId" TEXT,
    "subledgerAppliedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "issuedById" TEXT,
    "rejectedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "voidReason" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialNoteLine" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL,
    "taxRate" DECIMAL(65,30),
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "FinancialNoteLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialNoteEvent" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorId" TEXT,
    "reason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialNoteEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialNote_noteNumber_key" ON "FinancialNote"("noteNumber");
CREATE UNIQUE INDEX "FinancialNote_tripChargeId_key" ON "FinancialNote"("tripChargeId");
CREATE UNIQUE INDEX "FinancialNote_issuedJournalId_key" ON "FinancialNote"("issuedJournalId");
CREATE UNIQUE INDEX "FinancialNote_reversalJournalId_key" ON "FinancialNote"("reversalJournalId");
CREATE INDEX "FinancialNote_status_idx" ON "FinancialNote"("status");
CREATE INDEX "FinancialNote_noteType_counterpartyType_idx" ON "FinancialNote"("noteType", "counterpartyType");
CREATE INDEX "FinancialNote_vendorId_status_idx" ON "FinancialNote"("vendorId", "status");
CREATE INDEX "FinancialNote_clientId_status_idx" ON "FinancialNote"("clientId", "status");
CREATE INDEX "FinancialNote_tripId_idx" ON "FinancialNote"("tripId");
CREATE INDEX "FinancialNote_clientInvoiceId_idx" ON "FinancialNote"("clientInvoiceId");
CREATE INDEX "FinancialNote_accountingDate_idx" ON "FinancialNote"("accountingDate");

CREATE UNIQUE INDEX "FinancialNoteLine_noteId_lineNumber_key" ON "FinancialNoteLine"("noteId", "lineNumber");
CREATE INDEX "FinancialNoteLine_noteId_idx" ON "FinancialNoteLine"("noteId");

CREATE INDEX "FinancialNoteEvent_noteId_createdAt_idx" ON "FinancialNoteEvent"("noteId", "createdAt");

ALTER TABLE "VendorTripPayableAdjustment" ADD COLUMN "financialNoteId" TEXT;
CREATE INDEX "VendorTripPayableAdjustment_financialNoteId_idx" ON "VendorTripPayableAdjustment"("financialNoteId");

ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_tripChargeId_fkey" FOREIGN KEY ("tripChargeId") REFERENCES "TripCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_documentFileId_fkey" FOREIGN KEY ("documentFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_issuedJournalId_fkey" FOREIGN KEY ("issuedJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_reversalJournalId_fkey" FOREIGN KEY ("reversalJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_reversesNoteId_fkey" FOREIGN KEY ("reversesNoteId") REFERENCES "FinancialNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialNoteLine" ADD CONSTRAINT "FinancialNoteLine_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "FinancialNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialNoteEvent" ADD CONSTRAINT "FinancialNoteEvent_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "FinancialNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialNoteEvent" ADD CONSTRAINT "FinancialNoteEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VendorTripPayableAdjustment" ADD CONSTRAINT "VendorTripPayableAdjustment_financialNoteId_fkey" FOREIGN KEY ("financialNoteId") REFERENCES "FinancialNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
