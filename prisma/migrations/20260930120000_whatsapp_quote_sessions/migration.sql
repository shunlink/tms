-- WhatsApp quote session + inbound idempotency
CREATE TABLE "WhatsAppQuoteSession" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppQuoteSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppInboundEvent" (
    "messageId" TEXT NOT NULL,
    "quoteId" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppInboundEvent_pkey" PRIMARY KEY ("messageId")
);

CREATE UNIQUE INDEX "WhatsAppQuoteSession_vendorId_indentId_key" ON "WhatsAppQuoteSession"("vendorId", "indentId");
CREATE INDEX "WhatsAppQuoteSession_vendorId_status_idx" ON "WhatsAppQuoteSession"("vendorId", "status");
CREATE INDEX "WhatsAppQuoteSession_indentId_idx" ON "WhatsAppQuoteSession"("indentId");

ALTER TABLE "WhatsAppQuoteSession" ADD CONSTRAINT "WhatsAppQuoteSession_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppQuoteSession" ADD CONSTRAINT "WhatsAppQuoteSession_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
