-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "chatNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
