-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'AWAITING_ADVANCE' AFTER 'PROPOSED';

-- AlterTable: add nullable first so existing rows can be backfilled.
ALTER TABLE "Contract" ADD COLUMN "number" INTEGER;

-- Backfill in creation order: project/hourly contracts 101, 102…;
-- recurring contracts 301, 302….
UPDATE "Contract" AS c
SET "number" = n."number"
FROM (
  SELECT
    "id",
    (CASE WHEN "paymentType" = 'RECURRING' THEN 300 ELSE 100 END)
      + ROW_NUMBER() OVER (
          PARTITION BY ("paymentType" = 'RECURRING')
          ORDER BY "createdAt", "id"
        ) AS "number"
  FROM "Contract"
) AS n
WHERE c."id" = n."id";

ALTER TABLE "Contract" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Contract_number_key" ON "Contract"("number");
