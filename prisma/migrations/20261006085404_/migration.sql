-- AlterTable
ALTER TABLE "ClientPayment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IndentPod" ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE "VendorBalancePaymentTask" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VendorPayment" ALTER COLUMN "status" SET DEFAULT 'PAID';
