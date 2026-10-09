-- AlterTable
ALTER TABLE "ProjectExpense" ADD COLUMN     "currency" "PaymentCurrency" NOT NULL,
ADD COLUMN     "pkrAmount" DECIMAL(14,2) NOT NULL;

