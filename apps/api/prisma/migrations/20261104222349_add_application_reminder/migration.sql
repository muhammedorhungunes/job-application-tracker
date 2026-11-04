-- CreateTable
CREATE TABLE "ApplicationReminder" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationReminder_applicationId_sentAt_idx" ON "ApplicationReminder"("applicationId", "sentAt");

-- AddForeignKey
ALTER TABLE "ApplicationReminder" ADD CONSTRAINT "ApplicationReminder_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
