-- CreateEnum
CREATE TYPE "InterviewKind" AS ENUM ('PHONE', 'TECHNICAL', 'ONSITE', 'OTHER');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'INTERVIEW_CANCELLED';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "InterviewKind" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interview_applicationId_idx" ON "Interview"("applicationId");

-- CreateIndex
CREATE INDEX "Interview_deletedAt_idx" ON "Interview"("deletedAt");

-- CreateIndex
CREATE INDEX "Activity_deletedAt_idx" ON "Activity"("deletedAt");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
