-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('EARNING', 'EXPENSE', 'DONATION', 'TEAM_PAYMENT');

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "earningId" TEXT,
    "expenseId" TEXT,
    "donationId" TEXT,
    "teamPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_date_idx" ON "LedgerEntry"("date");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_idx" ON "LedgerEntry"("type");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "Earning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_teamPaymentId_fkey" FOREIGN KEY ("teamPaymentId") REFERENCES "TeamPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create ledger rows for every pre-existing Earning / Expense /
-- Donation / TeamPayment so the balance sheet reflects full history, not
-- just rows created after this migration.
INSERT INTO "LedgerEntry" (id, type, name, date, debit, credit, "earningId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EARNING', name, date, 0, amount, id, "createdAt", "updatedAt" FROM "Earning";

INSERT INTO "LedgerEntry" (id, type, name, date, debit, credit, "earningId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'TEAM_PAYMENT', 'Team pay — ' || name, date, "teamPay", 0, id, "createdAt", "updatedAt"
FROM "Earning" WHERE "teamPay" > 0;

INSERT INTO "LedgerEntry" (id, type, name, date, debit, credit, "expenseId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EXPENSE', name, date, amount, 0, id, "createdAt", "updatedAt" FROM "Expense";

INSERT INTO "LedgerEntry" (id, type, name, date, debit, credit, "donationId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'DONATION', name, date, amount, 0, id, "createdAt", "updatedAt" FROM "Donation";

INSERT INTO "LedgerEntry" (id, type, name, date, debit, credit, "teamPaymentId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'TEAM_PAYMENT', name, date, amount, 0, id, "createdAt", "updatedAt" FROM "TeamPayment";
