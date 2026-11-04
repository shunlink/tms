-- Juspay Hypercheckout + Payout integration

ALTER TABLE "OutboundPayment" ADD COLUMN "juspayOrderId" TEXT;
ALTER TABLE "OutboundPayment" ADD COLUMN "providerFulfillmentId" TEXT;
CREATE UNIQUE INDEX "OutboundPayment_juspayOrderId_key" ON "OutboundPayment"("juspayOrderId");

ALTER TABLE "VendorBeneficiary" ADD COLUMN "providerBeneficiaryRef" TEXT;
ALTER TABLE "VendorBeneficiary" ADD COLUMN "juspayValidationStatus" TEXT;
CREATE UNIQUE INDEX "VendorBeneficiary_providerBeneficiaryRef_key" ON "VendorBeneficiary"("providerBeneficiaryRef");

ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "inboundOrderId" TEXT;
CREATE INDEX "PaymentWebhookEvent_inboundOrderId_idx" ON "PaymentWebhookEvent"("inboundOrderId");

CREATE TABLE "InboundPaymentOrder" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "invoiceId" TEXT,
    "tripId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "juspayOrderId" TEXT NOT NULL,
    "paymentLinkUrl" TEXT,
    "returnUrl" TEXT,
    "providerStatus" TEXT,
    "providerTxnId" TEXT,
    "financeSettledAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundPaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboundPaymentOrder_idempotencyKey_key" ON "InboundPaymentOrder"("idempotencyKey");
CREATE UNIQUE INDEX "InboundPaymentOrder_juspayOrderId_key" ON "InboundPaymentOrder"("juspayOrderId");
CREATE INDEX "InboundPaymentOrder_clientId_status_idx" ON "InboundPaymentOrder"("clientId", "status");
CREATE INDEX "InboundPaymentOrder_invoiceId_idx" ON "InboundPaymentOrder"("invoiceId");
CREATE INDEX "InboundPaymentOrder_tripId_idx" ON "InboundPaymentOrder"("tripId");

CREATE TABLE "InboundPaymentRefund" (
    "id" TEXT NOT NULL,
    "inboundOrderId" TEXT NOT NULL,
    "uniqueRequestId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerRefundId" TEXT,
    "notes" TEXT,
    "initiatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundPaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboundPaymentRefund_uniqueRequestId_key" ON "InboundPaymentRefund"("uniqueRequestId");
CREATE INDEX "InboundPaymentRefund_inboundOrderId_idx" ON "InboundPaymentRefund"("inboundOrderId");

CREATE TABLE "InboundPaymentOutbox" (
    "id" TEXT NOT NULL,
    "inboundOrderId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundPaymentOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InboundPaymentOutbox_status_nextAttemptAt_idx" ON "InboundPaymentOutbox"("status", "nextAttemptAt");
CREATE INDEX "InboundPaymentOutbox_inboundOrderId_idx" ON "InboundPaymentOutbox"("inboundOrderId");

ALTER TABLE "ClientPayment" ADD COLUMN "inboundOrderId" TEXT;
CREATE UNIQUE INDEX "ClientPayment_inboundOrderId_key" ON "ClientPayment"("inboundOrderId");

ALTER TABLE "InboundPaymentOrder" ADD CONSTRAINT "InboundPaymentOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InboundPaymentOrder" ADD CONSTRAINT "InboundPaymentOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboundPaymentOrder" ADD CONSTRAINT "InboundPaymentOrder_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundPaymentRefund" ADD CONSTRAINT "InboundPaymentRefund_inboundOrderId_fkey" FOREIGN KEY ("inboundOrderId") REFERENCES "InboundPaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundPaymentRefund" ADD CONSTRAINT "InboundPaymentRefund_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundPaymentOutbox" ADD CONSTRAINT "InboundPaymentOutbox_inboundOrderId_fkey" FOREIGN KEY ("inboundOrderId") REFERENCES "InboundPaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPayment" ADD CONSTRAINT "ClientPayment_inboundOrderId_fkey" FOREIGN KEY ("inboundOrderId") REFERENCES "InboundPaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
