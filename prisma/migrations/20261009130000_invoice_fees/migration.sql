-- AlterTable
ALTER TABLE "Earning" ADD COLUMN     "fees" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "feesAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "feesPkr" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "InvoiceFee" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceFee_invoiceId_idx" ON "InvoiceFee"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceFee" ADD CONSTRAINT "InvoiceFee_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

