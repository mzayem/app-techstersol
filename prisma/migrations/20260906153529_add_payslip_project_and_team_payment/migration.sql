-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "contractId" TEXT;

-- CreateTable
CREATE TABLE "TeamPayment" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payslipId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamPayment_payslipId_key" ON "TeamPayment"("payslipId");

-- CreateIndex
CREATE INDEX "TeamPayment_date_idx" ON "TeamPayment"("date");

-- CreateIndex
CREATE INDEX "Payslip_contractId_idx" ON "Payslip"("contractId");

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPayment" ADD CONSTRAINT "TeamPayment_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

