import { prisma } from "@/lib/prisma";
import type { ClientStatus } from "@/lib/clients/constants";
import { dateWhere, type DateRange } from "@/lib/finance/date-range";

export type SortOption = "name-asc" | "name-desc" | "newest" | "oldest";

export type ListFilters = {
  search?: string;
  status?: ClientStatus;
  sort?: SortOption;
  /** Filters by `createdAt` — omit for no date filtering. */
  dateRange?: DateRange;
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

export async function listClients(filters: ListFilters) {
  return prisma.client.findMany({
    where: {
      status: filters.status,
      createdAt: filters.dateRange ? dateWhere(filters.dateRange) : undefined,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } },
            { country: { contains: filters.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { broughtByPartner: { select: { id: true, name: true } } },
    orderBy: orderBy(filters.sort),
  });
}

/** For the "Brought by partner" combobox on the client form — kept as its
 * own tiny inline query rather than importing from actions/partners/*
 * (owned by a concurrently in-flight change) to avoid a merge conflict. */
export async function listPartnerOptions() {
  return prisma.partner.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
