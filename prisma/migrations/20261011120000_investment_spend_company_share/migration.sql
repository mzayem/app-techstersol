-- AlterTable
ALTER TABLE "PartnerInvestmentSpend" ADD COLUMN     "companyExpenseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInvestmentSpend_companyExpenseId_key" ON "PartnerInvestmentSpend"("companyExpenseId");

-- AddForeignKey
ALTER TABLE "PartnerInvestmentSpend" ADD CONSTRAINT "PartnerInvestmentSpend_companyExpenseId_fkey" FOREIGN KEY ("companyExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

