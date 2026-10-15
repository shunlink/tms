-- Phase 6: Bank/gateway reconciliation and period close enhancements

ALTER TABLE "ReconciliationRecord" ADD COLUMN "matchingMethod" TEXT;
ALTER TABLE "ReconciliationRecord" ADD COLUMN "evidenceJson" JSONB;
ALTER TABLE "ReconciliationRecord" ADD COLUMN "bankStatementLineId" TEXT;
ALTER TABLE "ReconciliationRecord" ADD COLUMN "gatewaySettlementLineId" TEXT;
ALTER TABLE "ReconciliationRecord" ADD COLUMN "insufficientEvidence" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AccountingPeriod" ADD COLUMN "closeValidationReport" JSONB;
ALTER TABLE "AccountingPeriod" ADD COLUMN "closeNotes" TEXT;
ALTER TABLE "AccountingPeriod" ADD COLUMN "permittedExceptions" JSONB;

CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "glAccountCode" TEXT NOT NULL,
    "bankLabel" TEXT,
    "fileName" TEXT,
    "fileSha256" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT,
    "importSource" TEXT NOT NULL DEFAULT 'CSV_UPLOAD',
    "columnMapping" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "validationReport" JSONB,
    "duplicateOfId" TEXT,
    "importedById" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "glAccountCode" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "externalLineId" TEXT,
    "stableRowKey" TEXT NOT NULL,
    "transactionDate" DATE NOT NULL,
    "valueDate" DATE,
    "description" TEXT,
    "externalReference" TEXT,
    "direction" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "runningBalanceMinor" INTEGER,
    "rawRow" JSONB NOT NULL,
    "evidenceSource" TEXT NOT NULL DEFAULT 'MANUAL_CSV',
    "reconStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankReconciliationMatch" (
    "id" TEXT NOT NULL,
    "statementLineId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "matchingMethod" TEXT NOT NULL,
    "evidenceJson" JSONB,
    "rationale" TEXT,
    "varianceMinor" INTEGER NOT NULL DEFAULT 0,
    "varianceExplanation" TEXT,
    "journalEntryId" TEXT,
    "journalLineId" TEXT,
    "outboundPaymentId" TEXT,
    "ledgerEntryId" TEXT,
    "createdById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliationMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewaySettlementImport" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSha256" TEXT,
    "importSource" TEXT NOT NULL DEFAULT 'CSV_UPLOAD',
    "status" TEXT NOT NULL DEFAULT 'COMMITTED',
    "batchReference" TEXT,
    "settlementDate" DATE,
    "grossAmountMinor" INTEGER,
    "feesAmountMinor" INTEGER,
    "netAmountMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "rawPayload" JSONB,
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewaySettlementImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewaySettlementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "providerTransferRef" TEXT,
    "outboundPaymentId" TEXT,
    "amountMinor" INTEGER,
    "feeMinor" INTEGER,
    "netMinor" INTEGER,
    "stableRowKey" TEXT NOT NULL,
    "rawRow" JSONB NOT NULL,

    CONSTRAINT "GatewaySettlementLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankStatementLine_importId_lineNumber_key" ON "BankStatementLine"("importId", "lineNumber");
CREATE UNIQUE INDEX "BankStatementLine_glAccountCode_stableRowKey_key" ON "BankStatementLine"("glAccountCode", "stableRowKey");
CREATE INDEX "BankStatementLine_importId_idx" ON "BankStatementLine"("importId");
CREATE INDEX "BankStatementLine_reconStatus_idx" ON "BankStatementLine"("reconStatus");
CREATE INDEX "BankStatementLine_transactionDate_idx" ON "BankStatementLine"("transactionDate");

CREATE INDEX "BankStatementImport_glAccountCode_fileSha256_idx" ON "BankStatementImport"("glAccountCode", "fileSha256");
CREATE INDEX "BankStatementImport_status_idx" ON "BankStatementImport"("status");

CREATE INDEX "BankReconciliationMatch_statementLineId_status_idx" ON "BankReconciliationMatch"("statementLineId", "status");
CREATE INDEX "BankReconciliationMatch_outboundPaymentId_idx" ON "BankReconciliationMatch"("outboundPaymentId");
CREATE INDEX "BankReconciliationMatch_journalEntryId_idx" ON "BankReconciliationMatch"("journalEntryId");

CREATE UNIQUE INDEX "GatewaySettlementLine_importId_lineNumber_key" ON "GatewaySettlementLine"("importId", "lineNumber");
CREATE UNIQUE INDEX "GatewaySettlementLine_importId_stableRowKey_key" ON "GatewaySettlementLine"("importId", "stableRowKey");
CREATE INDEX "GatewaySettlementLine_providerTransferRef_idx" ON "GatewaySettlementLine"("providerTransferRef");
CREATE INDEX "GatewaySettlementLine_outboundPaymentId_idx" ON "GatewaySettlementLine"("outboundPaymentId");

CREATE INDEX "GatewaySettlementImport_providerId_batchReference_idx" ON "GatewaySettlementImport"("providerId", "batchReference");

CREATE INDEX "ReconciliationRecord_bankStatementLineId_idx" ON "ReconciliationRecord"("bankStatementLineId");

ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "BankStatementImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_statementLineId_fkey" FOREIGN KEY ("statementLineId") REFERENCES "BankStatementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_outboundPaymentId_fkey" FOREIGN KEY ("outboundPaymentId") REFERENCES "OutboundPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GatewaySettlementImport" ADD CONSTRAINT "GatewaySettlementImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GatewaySettlementLine" ADD CONSTRAINT "GatewaySettlementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "GatewaySettlementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_bankStatementLineId_fkey" FOREIGN KEY ("bankStatementLineId") REFERENCES "BankStatementLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_gatewaySettlementLineId_fkey" FOREIGN KEY ("gatewaySettlementLineId") REFERENCES "GatewaySettlementLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Legacy MATCHED rows without evidence require review
UPDATE "ReconciliationRecord"
SET "insufficientEvidence" = true,
    "notes" = COALESCE("notes", '') || CASE WHEN "notes" IS NULL OR "notes" = '' THEN '' ELSE ' | ' END || 'Flagged Phase 6: MATCHED without stored evidence — review required'
WHERE "status" = 'MATCHED'
  AND ("matchingMethod" IS NULL AND "evidenceJson" IS NULL AND "gatewaySettlementLineId" IS NULL AND "bankStatementLineId" IS NULL);
