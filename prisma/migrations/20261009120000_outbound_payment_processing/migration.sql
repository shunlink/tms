-- Outbound payment processing (gateway-agnostic)

CREATE TABLE "OutboundPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "settlementChannel" TEXT NOT NULL DEFAULT 'GATEWAY',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "indentId" TEXT,
    "tripId" TEXT,
    "vendorId" TEXT NOT NULL,
    "advanceRequestId" TEXT,
    "balancePaymentTaskId" TEXT,
    "beneficiaryId" TEXT,
    "providerId" TEXT,
    "providerTransferRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "ledgerPostedAt" TIMESTAMP(3),
    "initiatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "correlationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "providerMeta" JSONB,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorBeneficiary" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "accountHolder" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifsc" TEXT,
    "upiId" TEXT,
    "maskedDisplay" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "changeHistory" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBeneficiary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentApproval" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "policy" TEXT,
    "reason" TEXT,
    "approverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "errorMessage" TEXT,
    "paymentId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reference" TEXT,
    "description" TEXT,
    "reversalOfId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "providerId" TEXT NOT NULL,
    "providerTransferRef" TEXT,
    "internalAmountMinor" INTEGER,
    "providerAmountMinor" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "discrepancyType" TEXT,
    "notes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentOutbox" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboundPayment_paymentNumber_key" ON "OutboundPayment"("paymentNumber");
CREATE UNIQUE INDEX "OutboundPayment_idempotencyKey_key" ON "OutboundPayment"("idempotencyKey");
CREATE INDEX "OutboundPayment_vendorId_status_idx" ON "OutboundPayment"("vendorId", "status");
CREATE INDEX "OutboundPayment_indentId_idx" ON "OutboundPayment"("indentId");
CREATE INDEX "OutboundPayment_tripId_idx" ON "OutboundPayment"("tripId");
CREATE INDEX "OutboundPayment_status_idx" ON "OutboundPayment"("status");
CREATE INDEX "OutboundPayment_purpose_idx" ON "OutboundPayment"("purpose");
CREATE INDEX "OutboundPayment_advanceRequestId_idx" ON "OutboundPayment"("advanceRequestId");
CREATE INDEX "OutboundPayment_balancePaymentTaskId_idx" ON "OutboundPayment"("balancePaymentTaskId");
CREATE INDEX "OutboundPayment_providerTransferRef_idx" ON "OutboundPayment"("providerTransferRef");

CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");
CREATE INDEX "PaymentAttempt_paymentId_idx" ON "PaymentAttempt"("paymentId");
CREATE INDEX "PaymentAttempt_providerRef_idx" ON "PaymentAttempt"("providerRef");
CREATE INDEX "PaymentAttempt_idempotencyKey_idx" ON "PaymentAttempt"("idempotencyKey");

CREATE INDEX "VendorBeneficiary_vendorId_isActive_idx" ON "VendorBeneficiary"("vendorId", "isActive");
CREATE INDEX "VendorBeneficiary_verificationStatus_idx" ON "VendorBeneficiary"("verificationStatus");

CREATE INDEX "PaymentApproval_paymentId_idx" ON "PaymentApproval"("paymentId");

CREATE UNIQUE INDEX "PaymentWebhookEvent_providerId_providerEventId_key" ON "PaymentWebhookEvent"("providerId", "providerEventId");
CREATE INDEX "PaymentWebhookEvent_processingStatus_idx" ON "PaymentWebhookEvent"("processingStatus");
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");

CREATE INDEX "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");
CREATE INDEX "LedgerEntry_account_idx" ON "LedgerEntry"("account");

CREATE INDEX "PaymentAuditLog_paymentId_idx" ON "PaymentAuditLog"("paymentId");
CREATE INDEX "PaymentAuditLog_createdAt_idx" ON "PaymentAuditLog"("createdAt");

CREATE INDEX "ReconciliationRecord_status_idx" ON "ReconciliationRecord"("status");
CREATE INDEX "ReconciliationRecord_paymentId_idx" ON "ReconciliationRecord"("paymentId");

CREATE INDEX "PaymentOutbox_status_nextAttemptAt_idx" ON "PaymentOutbox"("status", "nextAttemptAt");
CREATE INDEX "PaymentOutbox_paymentId_idx" ON "PaymentOutbox"("paymentId");

ALTER TABLE "OutboundPayment" ADD CONSTRAINT "OutboundPayment_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundPayment" ADD CONSTRAINT "OutboundPayment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundPayment" ADD CONSTRAINT "OutboundPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutboundPayment" ADD CONSTRAINT "OutboundPayment_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "AdvanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundPayment" ADD CONSTRAINT "OutboundPayment_balancePaymentTaskId_fkey" FOREIGN KEY ("balancePaymentTaskId") REFERENCES "VendorBalancePaymentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundPayment" ADD CONSTRAINT "OutboundPayment_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "VendorBeneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundPayment" ADD CONSTRAINT "OutboundPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "OutboundPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VendorBeneficiary" ADD CONSTRAINT "VendorBeneficiary_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorBeneficiary" ADD CONSTRAINT "VendorBeneficiary_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentApproval" ADD CONSTRAINT "PaymentApproval_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "OutboundPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentApproval" ADD CONSTRAINT "PaymentApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "OutboundPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "OutboundPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentOutbox" ADD CONSTRAINT "PaymentOutbox_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "OutboundPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
