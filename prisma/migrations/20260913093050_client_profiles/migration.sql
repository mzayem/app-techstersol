-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientProfile_clientId_idx" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_appUserId_clientId_key" ON "ClientProfile"("appUserId", "clientId");

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: preserve every existing single-profile client login as a
-- ClientProfile row before the old AppUser.clientId column is dropped.
INSERT INTO "ClientProfile" ("id", "appUserId", "clientId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", "clientId", now()
FROM "AppUser"
WHERE "clientId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "AppUser" DROP CONSTRAINT "AppUser_clientId_fkey";

-- DropIndex
DROP INDEX "AppUser_clientId_key";

-- AlterTable
ALTER TABLE "AppUser" DROP COLUMN "clientId";
