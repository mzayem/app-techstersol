-- CreateEnum
CREATE TYPE "TeamMemberType" AS ENUM ('PROJECT_BASED', 'HOURLY');

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "type" "TeamMemberType" NOT NULL DEFAULT 'PROJECT_BASED',
ADD COLUMN     "hourlyRate" DECIMAL(14,2);
