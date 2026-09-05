-- CreateEnum
CREATE TYPE "BankCurrency" AS ENUM ('USD', 'EUR', 'GBP', 'AUD', 'PKR', 'AED');

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "currency" "BankCurrency" NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountType" TEXT,
    "routingNumber" TEXT,
    "accountNumber" TEXT,
    "iban" TEXT,
    "sortCode" TEXT,
    "bsbCode" TEXT,
    "swift" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccount_currency_idx" ON "BankAccount"("currency");
