-- External verification integration layer (GST, RC, DL, E-Way Bill)

-- Client GST verification metadata
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "gstVerificationStatus" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "gstVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "gstVerificationProvider" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "gstVerificationData" JSONB;

-- Vendor GST verification metadata
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "gstVerificationStatus" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "gstVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "gstVerificationProvider" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "gstVerificationData" JSONB;

-- Driver DL verification metadata
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlVerificationStatus" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlVerificationProvider" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlVerificationSnapshot" JSONB;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlIssueDate" TIMESTAMP(3);
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlStatus" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "dlVehicleClasses" TEXT;

-- Vehicle RC verification metadata
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "rcVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "rcVerificationStatus" TEXT;
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "rcVerifiedAt" TIMESTAMP(3);
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "rcVerificationProvider" TEXT;
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "rcVerificationSnapshot" JSONB;
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "complianceState" TEXT;
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "fuelType" TEXT;
ALTER TABLE "VehicleCompliance" ADD COLUMN IF NOT EXISTS "vehicleClass" TEXT;

-- Indent E-Way Bill operational snapshot
CREATE TABLE IF NOT EXISTS "IndentEwayBill" (
    "indentId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'NONE',
    "ewayBillNumber" TEXT,
    "status" TEXT,
    "supplierGstin" TEXT,
    "recipientGstin" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "documentDate" TIMESTAMP(3),
    "goodsDescription" TEXT,
    "hsnCode" TEXT,
    "quantity" TEXT,
    "value" DECIMAL(65,30),
    "origin" TEXT,
    "destination" TEXT,
    "transporterName" TEXT,
    "transporterGstin" TEXT,
    "vehicleNumber" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "provider" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndentEwayBill_pkey" PRIMARY KEY ("indentId")
);

ALTER TABLE "IndentEwayBill" DROP CONSTRAINT IF EXISTS "IndentEwayBill_indentId_fkey";
ALTER TABLE "IndentEwayBill" ADD CONSTRAINT "IndentEwayBill_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
