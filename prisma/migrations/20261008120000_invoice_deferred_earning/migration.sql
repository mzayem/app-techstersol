-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "completedContractIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
