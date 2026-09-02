import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { BUCKETS, DISTRIBUTION_SPLIT, type Bucket } from "@/lib/finance/constants";
import type { DateRange } from "@/lib/finance/date-range";

export type SortOption =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "name-asc"
  | "name-desc";

export type ListFilters = {
  dateRange: DateRange;
  search?: string;
  sort?: SortOption;
};

function dateWhere(range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

function orderBy(sort: SortOption | undefined, amountField: string) {
  switch (sort) {
    case "date-asc":
      return { date: "asc" as const };
    case "amount-desc":
      return { [amountField]: "desc" as const };
    case "amount-asc":
      return { [amountField]: "asc" as const };
    case "name-asc":
      return { name: "asc" as const };
    case "name-desc":
      return { name: "desc" as const };
    case "date-desc":
    default:
      return { date: "desc" as const };
  }
}

export async function listEarnings(filters: ListFilters) {
  return prisma.earning.findMany({
    where: {
      date: dateWhere(filters.dateRange),
      name: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy: orderBy(filters.sort, "amount"),
  });
}

export async function listExpenses(filters: ListFilters) {
  return prisma.expense.findMany({
    where: {
      date: dateWhere(filters.dateRange),
      name: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy: orderBy(filters.sort, "amount"),
  });
}

export async function listDonations(filters: ListFilters) {
  return prisma.donation.findMany({
    where: {
      date: dateWhere(filters.dateRange),
      name: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy: orderBy(filters.sort, "amount"),
  });
}

export type BucketBreakdown = {
  allocated: number;
  spent: number;
  remaining: number;
};

/** All-time allocated / spent / remaining for each distribution bucket. */
export async function getDistributionBreakdown(): Promise<
  Record<Bucket, BucketBreakdown>
> {
  const [earnings, expensesByCategory, donations] = await Promise.all([
    prisma.earning.aggregate({ _sum: { amount: true, teamPay: true } }),
    prisma.expense.groupBy({ by: ["category"], _sum: { amount: true } }),
    prisma.donation.aggregate({ _sum: { amount: true } }),
  ]);

  const netEarnings =
    Number(earnings._sum.amount ?? 0) - Number(earnings._sum.teamPay ?? 0);

  const spent: Record<string, number> = {};
  for (const row of expensesByCategory) {
    spent[row.category] = Number(row._sum.amount ?? 0);
  }
  spent.DONATION = Number(donations._sum.amount ?? 0);

  const breakdown = {} as Record<Bucket, BucketBreakdown>;
  for (const bucket of BUCKETS) {
    const allocated = netEarnings * DISTRIBUTION_SPLIT[bucket];
    const bucketSpent = spent[bucket] ?? 0;
    breakdown[bucket] = {
      allocated,
      spent: bucketSpent,
      remaining: allocated - bucketSpent,
    };
  }
  return breakdown;
}

/** All-time balance remaining in each distribution bucket. */
export async function getBucketBalances(): Promise<Record<Bucket, number>> {
  const breakdown = await getDistributionBreakdown();
  const balances = {} as Record<Bucket, number>;
  for (const bucket of BUCKETS) {
    balances[bucket] = breakdown[bucket].remaining;
  }
  return balances;
}

export async function getTotalNetEarnings() {
  const sum = await prisma.earning.aggregate({
    _sum: { amount: true, teamPay: true },
  });
  return Number(sum._sum.amount ?? 0) - Number(sum._sum.teamPay ?? 0);
}
