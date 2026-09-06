import { prisma } from "@/lib/prisma";

export type SortOption = "name-asc" | "name-desc" | "newest" | "oldest";

export type ListFilters = {
  search?: string;
  sort?: SortOption;
};

function orderBy(sort: SortOption | undefined) {
  switch (sort) {
    case "name-desc":
      return { name: "desc" as const };
    case "oldest":
      return { createdAt: "asc" as const };
    case "newest":
      return { createdAt: "desc" as const };
    case "name-asc":
    default:
      return { name: "asc" as const };
  }
}

export async function listTeamMembers(filters: ListFilters) {
  return prisma.teamMember.findMany({
    where: {
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: orderBy(filters.sort),
  });
}

/** Lightweight options list for the contract and payslip dialogs' team
 * member pickers. */
export async function listTeamMemberOptions() {
  return prisma.teamMember.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}
