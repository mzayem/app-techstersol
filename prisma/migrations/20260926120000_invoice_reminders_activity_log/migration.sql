-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");


-- Grant the new Activity Log page (view-only) to every role that can
-- already view Users, so existing admins see it without editing roles.
INSERT INTO "RolePermission" ("id", "roleId", "page", "canView", "canCreate", "canEdit", "canDelete")
SELECT gen_random_uuid()::text, rp."roleId", 'activity-log', true, false, false, false
FROM "RolePermission" rp
WHERE rp."page" = 'users' AND rp."canView" = true
ON CONFLICT ("roleId", "page") DO NOTHING;
