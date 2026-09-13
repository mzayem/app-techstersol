-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "chatNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: add authorKind as nullable first so existing rows can be
-- backfilled from the author's current AppUser.kind before the NOT NULL
-- constraint is applied.
ALTER TABLE "ContractMessage" ADD COLUMN     "authorKind" "UserKind";

UPDATE "ContractMessage" cm
SET "authorKind" = au."kind"
FROM "AppUser" au
WHERE cm."authorUserId" = au."id";

-- Any message whose author no longer has an AppUser row (e.g. deleted
-- login) falls back to DASHBOARD_HANDLER — the least surprising default
-- for legacy data, since dashboard/team accounts predate the CLIENT kind.
UPDATE "ContractMessage" SET "authorKind" = 'DASHBOARD_HANDLER' WHERE "authorKind" IS NULL;

ALTER TABLE "ContractMessage" ALTER COLUMN "authorKind" SET NOT NULL;

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "payslipEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CredentialViewLink" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "passwordCiphertext" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialViewLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CredentialViewLink_tokenHash_key" ON "CredentialViewLink"("tokenHash");

-- CreateIndex
CREATE INDEX "CredentialViewLink_appUserId_idx" ON "CredentialViewLink"("appUserId");

-- AddForeignKey
ALTER TABLE "CredentialViewLink" ADD CONSTRAINT "CredentialViewLink_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
