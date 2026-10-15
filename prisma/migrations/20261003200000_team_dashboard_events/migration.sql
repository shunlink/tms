-- Team dashboard: route important events to the responsible internal team
ALTER TABLE "ImportantEvent" ADD COLUMN "targetTeamCode" TEXT;

CREATE INDEX "ImportantEvent_targetTeamCode_status_idx" ON "ImportantEvent"("targetTeamCode", "status");

-- Backfill target team from event type
UPDATE "ImportantEvent"
SET "targetTeamCode" = CASE
  WHEN "type" IN (
    'INVOICE_PENDING', 'INVOICE_SLA_BREACHED',
    'ADVANCE_PENDING', 'ADVANCE_SLA_BREACHED', 'EXTERNAL_ADVANCE_SELECTED'
  ) THEN 'FINANCE'
  WHEN "type" IN (
    'POD_PENDING', 'POD_REJECTED', 'POD_SLA_BREACHED',
    'ALLOCATION_PLACEMENT_DEADLINE', 'VEHICLE_NOT_REACHED',
    'DRIVER_OTP_PENDING', 'TRACKING_INACTIVE', 'VENDOR_QUOTE_RECEIVED'
  ) THEN 'OPERATIONS'
  ELSE NULL
END
WHERE "targetTeamCode" IS NULL;
