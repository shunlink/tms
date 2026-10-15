-- Superadmin portal access: Master OTP + impersonation sessions
CREATE TABLE "MasterOtpConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "otpHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterOtpConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalAccessSession" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAccessSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortalAccessSession_actorUserId_endedAt_idx" ON "PortalAccessSession"("actorUserId", "endedAt");
CREATE INDEX "PortalAccessSession_expiresAt_idx" ON "PortalAccessSession"("expiresAt");
CREATE INDEX "PortalAccessSession_targetUserId_idx" ON "PortalAccessSession"("targetUserId");

ALTER TABLE "MasterOtpConfig" ADD CONSTRAINT "MasterOtpConfig_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PortalAccessSession" ADD CONSTRAINT "PortalAccessSession_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalAccessSession" ADD CONSTRAINT "PortalAccessSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalAccessSession" ADD CONSTRAINT "PortalAccessSession_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
