/*
  Warnings:

  - Changed the type of `currency` on the `BankAccount` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "PaymentCurrency" ADD VALUE 'AED';

-- AlterTable
ALTER TABLE "BankAccount" DROP COLUMN "currency",
ADD COLUMN     "currency" "PaymentCurrency" NOT NULL;

-- DropEnum
DROP TYPE "BankCurrency";

-- CreateIndex
CREATE INDEX "BankAccount_currency_idx" ON "BankAccount"("currency");
