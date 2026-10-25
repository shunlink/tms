-- Vendor settlement model: credit (pay on due date) vs adhoc (immediate / per-trip).
ALTER TABLE "VendorCommercial" ADD COLUMN "paymentTermsType" TEXT;
