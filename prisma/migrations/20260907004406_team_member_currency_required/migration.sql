-- Backfill any existing team members with no currency set, so the
-- following NOT NULL constraint doesn't reject them.
UPDATE "TeamMember" SET "currency" = 'PKR' WHERE "currency" IS NULL;

-- AlterTable
ALTER TABLE "TeamMember" ALTER COLUMN "currency" SET NOT NULL;
