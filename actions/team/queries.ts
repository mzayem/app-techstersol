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

/** Every TeamPayment — money that actually left the company for a team
 * member — with the payslip that generated it, if any. Read-only view; a
 * TeamPayment is only ever created as a side effect of issuing a payslip
 * (see actions/team/payslip-actions.ts). */
export async function listTeamPayments() {
  return prisma.teamPayment.findMany({
    include: {
      payslip: {
        select: { number: true, teamMember: { select: { name: true } } },
      },
    },
    orderBy: { date: "desc" },
  });
}
