-- CreateTable
CREATE TABLE "WorkDiaryEntry" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "amount" DECIMAL(14,2),
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkDiaryEntry_teamMemberId_weekStart_key" ON "WorkDiaryEntry"("teamMemberId", "weekStart");

-- CreateIndex
CREATE INDEX "WorkDiaryEntry_teamMemberId_idx" ON "WorkDiaryEntry"("teamMemberId");

-- CreateIndex
CREATE INDEX "WorkDiaryEntry_weekStart_idx" ON "WorkDiaryEntry"("weekStart");

-- AddForeignKey
ALTER TABLE "WorkDiaryEntry" ADD CONSTRAINT "WorkDiaryEntry_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
