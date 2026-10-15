-- Extend AuditLog for employee activity tracking (append-only)
ALTER TABLE "AuditLog" ADD COLUMN "teamId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "teamCode" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "tripId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "before" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "after" TEXT;

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_teamCode_idx" ON "AuditLog"("teamCode");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_tripId_idx" ON "AuditLog"("tripId");
