-- Trip denormalized live position
ALTER TABLE "Trip" ADD COLUMN "currentLat" DOUBLE PRECISION;
ALTER TABLE "Trip" ADD COLUMN "currentLng" DOUBLE PRECISION;
ALTER TABLE "Trip" ADD COLUMN "lastPingAt" TIMESTAMP(3);

-- Cell tower lookup (OpenCelliD ingest in Phase 5)
CREATE TABLE "CellTower" (
    "id" TEXT NOT NULL,
    "mcc" INTEGER NOT NULL,
    "mnc" INTEGER NOT NULL,
    "lac" INTEGER NOT NULL,
    "cellId" BIGINT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CellTower_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CellTower_mcc_mnc_lac_cellId_key" ON "CellTower"("mcc", "mnc", "lac", "cellId");
CREATE INDEX "CellTower_mcc_mnc_lac_cellId_idx" ON "CellTower"("mcc", "mnc", "lac", "cellId");
