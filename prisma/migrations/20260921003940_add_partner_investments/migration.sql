-- CreateEnum
CREATE TYPE "InvestmentMethod" AS ENUM ('PENDING_PAYMENT', 'CASH', 'ONLINE');

-- AlterTable
ALTER TABLE "PartnerPayment" ADD COLUMN     "partnerInvestmentId" TEXT;

-- CreateTable
CREATE TABLE "PartnerInvestment" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "partnerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "InvestmentMethod" NOT NULL,
    "transactionId" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerInvestment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerInvestmentSpend" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerInvestmentSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInvestment_number_key" ON "PartnerInvestment"("number");

-- CreateIndex
CREATE INDEX "PartnerInvestment_partnerId_idx" ON "PartnerInvestment"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerInvestment_date_idx" ON "PartnerInvestment"("date");

-- CreateIndex
CREATE INDEX "PartnerInvestmentSpend_partnerId_idx" ON "PartnerInvestmentSpend"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerInvestmentSpend_date_idx" ON "PartnerInvestmentSpend"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPayment_partnerInvestmentId_key" ON "PartnerPayment"("partnerInvestmentId");

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_partnerInvestmentId_fkey" FOREIGN KEY ("partnerInvestmentId") REFERENCES "PartnerInvestment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInvestment" ADD CONSTRAINT "PartnerInvestment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInvestmentSpend" ADD CONSTRAINT "PartnerInvestmentSpend_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

