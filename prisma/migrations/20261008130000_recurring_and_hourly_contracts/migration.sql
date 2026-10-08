-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContractPaymentType" ADD VALUE 'HOURLY';
ALTER TYPE "ContractPaymentType" ADD VALUE 'RECURRING';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "billingCycle" "BillingCycle",
ADD COLUMN     "invoiceDueDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "nextInvoiceDate" DATE,
ADD COLUMN     "terms" TEXT,
ALTER COLUMN "deadline" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "periodEnd" DATE,
ADD COLUMN     "periodStart" DATE;

-- AlterTable
ALTER TABLE "PartnerPayment" ADD COLUMN     "invoiceId" TEXT;

-- CreateTable
CREATE TABLE "ContractHourLog" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "note" TEXT,
    "invoiceItemId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractHourLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractHourLog_contractId_idx" ON "ContractHourLog"("contractId");

-- CreateIndex
CREATE INDEX "ContractHourLog_invoiceItemId_idx" ON "ContractHourLog"("invoiceItemId");

-- CreateIndex
CREATE INDEX "Contract_paymentType_idx" ON "Contract"("paymentType");

-- CreateIndex
CREATE INDEX "PartnerPayment_invoiceId_idx" ON "PartnerPayment"("invoiceId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractHourLog" ADD CONSTRAINT "ContractHourLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractHourLog" ADD CONSTRAINT "ContractHourLog_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

