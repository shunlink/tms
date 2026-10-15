CREATE TABLE "IndentReleaseCity" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,

    CONSTRAINT "IndentReleaseCity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IndentVendorRelease" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndentVendorRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndentReleaseCity_indentId_city_key" ON "IndentReleaseCity"("indentId", "city");
CREATE INDEX "IndentReleaseCity_indentId_idx" ON "IndentReleaseCity"("indentId");

CREATE UNIQUE INDEX "IndentVendorRelease_indentId_vendorId_key" ON "IndentVendorRelease"("indentId", "vendorId");
CREATE INDEX "IndentVendorRelease_indentId_idx" ON "IndentVendorRelease"("indentId");
CREATE INDEX "IndentVendorRelease_vendorId_idx" ON "IndentVendorRelease"("vendorId");

ALTER TABLE "IndentReleaseCity" ADD CONSTRAINT "IndentReleaseCity_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IndentReleaseCity" ADD CONSTRAINT "IndentReleaseCity_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IndentVendorRelease" ADD CONSTRAINT "IndentVendorRelease_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IndentVendorRelease" ADD CONSTRAINT "IndentVendorRelease_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
