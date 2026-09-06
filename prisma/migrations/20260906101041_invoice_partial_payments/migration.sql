
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContractStatus" ADD VALUE 'UPFRONT_PAYMENT';
ALTER TYPE "ContractStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Earning" ADD COLUMN     "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "isPartial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "milestoneId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Earning_invoiceId_key" ON "Earning"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_contractId_idx" ON "InvoiceItem"("contractId");

-- CreateIndex
CREATE INDEX "InvoiceItem_milestoneId_idx" ON "InvoiceItem"("milestoneId");

-- AddForeignKey
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

