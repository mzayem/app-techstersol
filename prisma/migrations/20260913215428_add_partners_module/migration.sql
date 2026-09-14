-- CreateEnum
CREATE TYPE "ContractWorkCostMode" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "PartnerPaymentSource" AS ENUM ('AUTO_COMPLETION', 'MANUAL');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'PARTNER_PAYMENT';

-- AlterEnum
ALTER TYPE "UserKind" ADD VALUE 'PARTNER';

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "partnerId" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "broughtByPartnerId" TEXT,
ADD COLUMN     "emailVisibleToPartner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneVisibleToPartner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "partnerSharePercent" DECIMAL(5,2),
ADD COLUMN     "workCostMode" "ContractWorkCostMode",
ADD COLUMN     "workCostPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Earning" ADD COLUMN     "partnerShare" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "projectExpenses" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "partnerPaymentId" TEXT,
ADD COLUMN     "projectExpenseId" TEXT;

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "currency" "PaymentCurrency" NOT NULL,
    "sharePercentage" DECIMAL(5,2) NOT NULL,
    "payslipEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayment" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "contractId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "source" "PartnerPaymentSource" NOT NULL DEFAULT 'MANUAL',
    "revenueAmount" DECIMAL(14,2),
    "workCostAmount" DECIMAL(14,2),
    "projectExpensesAmount" DECIMAL(14,2),
    "profitAmount" DECIMAL(14,2),
    "sharePercentageUsed" DECIMAL(5,2),
    "partnerPayslipId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayslip" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "partnerId" TEXT NOT NULL,
    "contractId" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "issueDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetCode_appUserId_idx" ON "PasswordResetCode"("appUserId");

-- CreateIndex
CREATE INDEX "Partner_name_idx" ON "Partner"("name");

-- CreateIndex
CREATE INDEX "ProjectExpense_contractId_idx" ON "ProjectExpense"("contractId");

-- CreateIndex
CREATE INDEX "ProjectExpense_date_idx" ON "ProjectExpense"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPayment_partnerPayslipId_key" ON "PartnerPayment"("partnerPayslipId");

-- CreateIndex
CREATE INDEX "PartnerPayment_date_idx" ON "PartnerPayment"("date");

-- CreateIndex
CREATE INDEX "PartnerPayment_partnerId_idx" ON "PartnerPayment"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerPayment_contractId_idx" ON "PartnerPayment"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPayslip_number_key" ON "PartnerPayslip"("number");

-- CreateIndex
CREATE INDEX "PartnerPayslip_partnerId_idx" ON "PartnerPayslip"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerPayslip_contractId_idx" ON "PartnerPayslip"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_partnerId_key" ON "AppUser"("partnerId");

-- CreateIndex
CREATE INDEX "Client_broughtByPartnerId_idx" ON "Client"("broughtByPartnerId");

-- CreateIndex
CREATE INDEX "Contract_partnerId_idx" ON "Contract"("partnerId");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_broughtByPartnerId_fkey" FOREIGN KEY ("broughtByPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetCode" ADD CONSTRAINT "PasswordResetCode_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_partnerPayslipId_fkey" FOREIGN KEY ("partnerPayslipId") REFERENCES "PartnerPayslip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayslip" ADD CONSTRAINT "PartnerPayslip_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayslip" ADD CONSTRAINT "PartnerPayslip_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_projectExpenseId_fkey" FOREIGN KEY ("projectExpenseId") REFERENCES "ProjectExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partnerPaymentId_fkey" FOREIGN KEY ("partnerPaymentId") REFERENCES "PartnerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

