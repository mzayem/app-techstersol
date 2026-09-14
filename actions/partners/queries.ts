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

export async function listPartners(filters: ListFilters = {}) {
  return prisma.partner.findMany({
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

/** Lightweight options list for the contract form, payslip dialog, and
 * client-attribution pickers elsewhere in the app. sharePercentage rides
 * along (as a plain number — a Prisma Decimal can't cross the Server →
 * Client Component boundary as-is) so a contract form can pre-fill its
 * partner-share override field from the partner's default. */
export async function listPartnerOptions() {
  const partners = await prisma.partner.findMany({
    select: { id: true, name: true, sharePercentage: true },
    orderBy: { name: "asc" },
    take: 100,
  });
  return partners.map((p) => ({
    ...p,
    sharePercentage: Number(p.sharePercentage),
  }));
}

/** Contracts that have a partner assigned — the candidates for a partner
 * payslip's optional "assigned project" field, scoped to the chosen
 * partner client-side. Mirrors listOutsourcedContractOptions
 * (actions/contracts/queries.ts). */
export async function listPartnerContractOptions() {
  return prisma.contract.findMany({
    where: { partnerId: { not: null } },
    select: { id: true, projectName: true, partnerId: true },
    orderBy: { date: "desc" },
  });
}
