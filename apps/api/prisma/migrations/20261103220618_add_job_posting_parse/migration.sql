-- CreateEnum
CREATE TYPE "JobPostingParseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "JobPostingParse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" "JobPostingParseStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "errorMessage" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JobPostingParse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPostingParse_userId_idx" ON "JobPostingParse"("userId");

-- CreateIndex
CREATE INDEX "JobPostingParse_deletedAt_idx" ON "JobPostingParse"("deletedAt");

-- AddForeignKey
ALTER TABLE "JobPostingParse" ADD CONSTRAINT "JobPostingParse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
