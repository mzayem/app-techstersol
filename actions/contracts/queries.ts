import { prisma } from "@/lib/prisma";
import type { ContractStatus } from "@/lib/contracts/constants";

export type SortOption =
  | "date-desc"
  | "date-asc"
  | "deadline-asc"
  | "deadline-desc"
  | "name-asc"
  | "name-desc";

export type ListFilters = {
  search?: string;
  status?: ContractStatus;
  sort?: SortOption;
};

function orderBy(sort: SortOption | undefined) {
  switch (sort) {
    case "date-asc":
      return { date: "asc" as const };
    case "deadline-asc":
      return { deadline: "asc" as const };
    case "deadline-desc":
      return { deadline: "desc" as const };
    case "name-asc":
      return { projectName: "asc" as const };
    case "name-desc":
      return { projectName: "desc" as const };
    case "date-desc":
    default:
      return { date: "desc" as const };
  }
}

export async function listContracts(filters: ListFilters) {
  return prisma.contract.findMany({
    where: {
      status: filters.status,
      OR: filters.search
        ? [
            { projectName: { contains: filters.search, mode: "insensitive" } },
            { client: { name: { contains: filters.search, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: {
      client: { select: { id: true, name: true } },
      milestones: { orderBy: { deadline: "asc" } },
    },
    orderBy: orderBy(filters.sort),
  });
}

export async function listClientOptions() {
  return prisma.client.findMany({
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });
}
