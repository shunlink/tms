-- Per-vehicle placement on indent lines
ALTER TABLE "IndentLine" ADD COLUMN "placementStatus" TEXT NOT NULL DEFAULT 'PLACEMENT_PENDING';
ALTER TABLE "IndentLine" ADD COLUMN "placementReachedAt" TIMESTAMP(3);

CREATE INDEX "IndentLine_indentId_placementStatus_idx" ON "IndentLine"("indentId", "placementStatus");

-- Backfill line 1 placement from indent header when vehicle already reached
UPDATE "IndentLine" il
SET
  "placementStatus" = 'VEHICLE_REACHED',
  "placementReachedAt" = COALESCE(i."updatedAt", NOW())
FROM "Indent" i
WHERE il."indentId" = i.id
  AND il."lineNumber" = 1
  AND i."placementStatus" = 'VEHICLE_REACHED'
  AND il."placementStatus" = 'PLACEMENT_PENDING';

-- Copy indent vehicle/driver onto line 1 active allocation when present
UPDATE "IndentAllocation" ia
SET
  "vehicleId" = COALESCE(ia."vehicleId", i."vehicleId"),
  "driverId" = COALESCE(ia."driverId", i."driverId")
FROM "Indent" i
JOIN "IndentLine" il ON il."indentId" = i.id AND il."lineNumber" = 1
WHERE ia."indentLineId" = il.id
  AND ia.status = 'ACTIVE'
  AND (i."vehicleId" IS NOT NULL OR i."driverId" IS NOT NULL);
