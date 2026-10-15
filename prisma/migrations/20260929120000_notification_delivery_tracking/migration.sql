-- AlterTable
ALTER TABLE "Notification"
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "error" TEXT;
