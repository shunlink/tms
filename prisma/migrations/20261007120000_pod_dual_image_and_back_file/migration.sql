-- Add back side image for POD (front remains in fileId)
ALTER TABLE "IndentPod" ADD COLUMN "backFileId" TEXT;

ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_backFileId_fkey" FOREIGN KEY ("backFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "IndentPod_backFileId_idx" ON "IndentPod"("backFileId");
