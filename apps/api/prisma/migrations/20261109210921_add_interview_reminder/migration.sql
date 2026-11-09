-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "remindedForScheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");
