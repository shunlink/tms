-- Login-free vendor quote links from WhatsApp
ALTER TABLE "WhatsAppQuoteSession" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "WhatsAppQuoteSession" ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "WhatsAppQuoteSession_accessToken_key" ON "WhatsAppQuoteSession"("accessToken");
