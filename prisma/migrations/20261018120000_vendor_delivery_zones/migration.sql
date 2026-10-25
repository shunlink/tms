CREATE TABLE "VendorDeliveryZone" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,

    CONSTRAINT "VendorDeliveryZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IndentReleaseZone" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,

    CONSTRAINT "IndentReleaseZone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorDeliveryZone_vendorId_zone_key" ON "VendorDeliveryZone"("vendorId", "zone");
CREATE INDEX "VendorDeliveryZone_vendorId_idx" ON "VendorDeliveryZone"("vendorId");

CREATE UNIQUE INDEX "IndentReleaseZone_indentId_zone_key" ON "IndentReleaseZone"("indentId", "zone");
CREATE INDEX "IndentReleaseZone_indentId_idx" ON "IndentReleaseZone"("indentId");

ALTER TABLE "VendorDeliveryZone" ADD CONSTRAINT "VendorDeliveryZone_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IndentReleaseZone" ADD CONSTRAINT "IndentReleaseZone_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IndentReleaseZone" ADD CONSTRAINT "IndentReleaseZone_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
