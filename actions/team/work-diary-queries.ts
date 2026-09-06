import { prisma } from "@/lib/prisma";

export type SortOption = "week-desc" | "week-asc";

export type ListFilters = {
  teamMemberId?: string;
  /** "YYYY-MM" — matches entries whose week starts in that calendar month. */
  month?: string;
  sort?: SortOption;
};

function monthRange(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const from = new Date(year, monthNum - 1, 1);
  const to = new Date(year, monthNum, 0); // last day of the month
  return { gte: from, lte: to };
}

export async function listWorkDiaryEntries(filters: ListFilters) {
  return prisma.workDiaryEntry.findMany({
    where: {
      teamMemberId: filters.teamMemberId || undefined,
      weekStart: filters.month ? monthRange(filters.month) : undefined,
    },
    include: {
      teamMember: { select: { id: true, name: true } },
    },
    orderBy:
      filters.sort === "week-asc"
        ? { weekStart: "asc" }
        : { weekStart: "desc" },
  });
}
