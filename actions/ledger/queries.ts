import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/finance/date-range";

export type SortOption = "date-desc" | "date-asc";

export type ListFilters = {
  dateRange?: DateRange;
  search?: string;
  sort?: SortOption;
};

function dateWhere(range?: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range || (!range.from && !range.to)) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

export async function listLedgerEntries(filters: ListFilters) {
  return prisma.ledgerEntry.findMany({
    where: {
      date: dateWhere(filters.dateRange),
      name: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy:
      filters.sort === "date-asc"
        ? [{ date: "asc" }, { createdAt: "asc" }]
        : [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export type LedgerBalance = {
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

/** All-time totals across the ledger — the audit trail's current cash
 * balance, independent of the distribution buckets' allocated/spent view. */
export async function getLedgerBalance(): Promise<LedgerBalance> {
  const sum = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
  });
  const totalDebit = Number(sum._sum.debit ?? 0);
  const totalCredit = Number(sum._sum.credit ?? 0);
  return { totalDebit, totalCredit, balance: totalCredit - totalDebit };
}
