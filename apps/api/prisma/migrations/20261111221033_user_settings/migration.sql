-- AlterTable
ALTER TABLE "User" ADD COLUMN     "interviewRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "staleDays" INTEGER,
ADD COLUMN     "staleDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timeZone" TEXT;
