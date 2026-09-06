-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('DASHBOARD_HANDLER', 'TEAM');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "UserKind" NOT NULL,
    "roleId" TEXT,
    "teamMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_page_key" ON "RolePermission"("roleId", "page");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_authUserId_key" ON "AppUser"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_teamMemberId_key" ON "AppUser"("teamMemberId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: an "Admin" role with full access to every page, and the existing
-- account (the only user id seen in current data) as its first Admin, so
-- rolling out RBAC doesn't lock anyone out.
INSERT INTO "Role" (id, name, "createdAt", "updatedAt")
VALUES ('admin-role-seed', 'Admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "RolePermission" (id, "roleId", page, "canView", "canCreate", "canEdit", "canDelete")
SELECT gen_random_uuid()::text, 'admin-role-seed', page, true, true, true, true
FROM (VALUES
  ('clients'), ('earning'), ('expenses'), ('distributions'), ('donations'),
  ('bank-details'), ('balance-sheet'), ('contracts'), ('invoices'),
  ('team'), ('payslips'), ('work-diary'), ('roles'), ('users')
) AS pages(page);

INSERT INTO "AppUser" (id, "authUserId", email, name, kind, "roleId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'aa44de16-067a-48a5-b26e-95718e0e8bf6',
  'mzayemazam@gmail.com',
  'Muhammad Zayem',
  'DASHBOARD_HANDLER',
  'admin-role-seed',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
