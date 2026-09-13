-- CreateEnum
CREATE TYPE "AppUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "lockoutStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "AppUserStatus" NOT NULL DEFAULT 'ACTIVE';
