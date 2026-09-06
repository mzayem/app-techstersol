-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "teamMemberId" TEXT,
ADD COLUMN     "teamPayAmount" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "country" TEXT,
    "currency" "PaymentCurrency",
    "address" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "issueDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMember_name_idx" ON "TeamMember"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_number_key" ON "Payslip"("number");

-- CreateIndex
CREATE INDEX "Payslip_teamMemberId_idx" ON "Payslip"("teamMemberId");

-- CreateIndex
CREATE INDEX "Contract_teamMemberId_idx" ON "Contract"("teamMemberId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

