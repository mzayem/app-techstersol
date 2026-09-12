-- CreateTable
CREATE TABLE "ContractMessage" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractMessage_contractId_idx" ON "ContractMessage"("contractId");

-- AddForeignKey
ALTER TABLE "ContractMessage" ADD CONSTRAINT "ContractMessage_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
