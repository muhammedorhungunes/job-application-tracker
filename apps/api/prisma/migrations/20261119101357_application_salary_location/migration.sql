-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('YEAR', 'MONTH', 'HOUR');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "location" TEXT,
ADD COLUMN     "salaryCurrency" TEXT,
ADD COLUMN     "salaryMax" DECIMAL(12,2),
ADD COLUMN     "salaryMin" DECIMAL(12,2),
ADD COLUMN     "salaryPeriod" "SalaryPeriod",
ADD COLUMN     "workMode" "WorkMode";
