import { prisma } from "@/lib/prisma";
import { resolveWorkDiaryPeriod } from "@/lib/team/work-diary";

export type SortOption = "week-desc" | "week-asc";

export type ListFilters = {
  teamMemberId?: string;
  /** "all" | "year" | "custom" | "YYYY-MM" — see resolveWorkDiaryPeriod. */
  period?: string;
  from?: string;
  to?: string;
  sort?: SortOption;
};

export async function listWorkDiaryEntries(filters: ListFilters) {
  const { gte, lte } = resolveWorkDiaryPeriod(filters.period, filters.from, filters.to);

  return prisma.workDiaryEntry.findMany({
    where: {
      teamMemberId: filters.teamMemberId || undefined,
      weekStart:
        gte || lte
          ? { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) }
          : undefined,
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
