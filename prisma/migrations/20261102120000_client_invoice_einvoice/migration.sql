-- AlterTable
ALTER TABLE "ClientInvoice" ADD COLUMN "eInvoiceIrn" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN "eInvoiceAckNo" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN "eInvoiceGeneratedAt" TIMESTAMP(3);
