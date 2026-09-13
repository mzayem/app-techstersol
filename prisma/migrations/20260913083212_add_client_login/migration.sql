-- AlterEnum
ALTER TYPE "UserKind" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_clientId_key" ON "AppUser"("clientId");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
