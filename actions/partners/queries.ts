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

export type PartnerAccrual = {
  contractId: string;
  partnerId: string;
  projectName: string;
  amount: number;
  revenueAmount: number | null;
  workCostAmount: number | null;
  projectExpensesAmount: number | null;
  profitAmount: number | null;
  sharePercentageUsed: number | null;
};

/** Every partnered project that's completed and booked a profit share
 * (AUTO_COMPLETION PartnerPayment) but has no payslip issued against it
 * yet — the "pending payouts" a partner payslip can be raised for. Feeds
 * the payslip dialog's project picker, auto-filling the amount (and a
 * cost breakdown) from the already-booked, attributable PartnerPayment
 * rather than requiring it to be typed in by hand. */
export async function listPartnerPendingAccruals(): Promise<PartnerAccrual[]> {
  const payments = await prisma.partnerPayment.findMany({
    where: {
      source: "AUTO_COMPLETION",
      partnerPayslipId: null,
      // A payment already redirected into investment (see
      // actions/partners/investment-actions.ts) is spoken for — it no
      // longer counts as an outstanding payout either.
      partnerInvestmentId: null,
      contractId: { not: null },
    },
    select: {
      contractId: true,
      partnerId: true,
      amount: true,
      revenueAmount: true,
      workCostAmount: true,
      projectExpensesAmount: true,
      profitAmount: true,
      sharePercentageUsed: true,
      contract: { select: { projectName: true } },
    },
    orderBy: { date: "desc" },
  });

  return payments.map((p) => ({
    contractId: p.contractId!,
    partnerId: p.partnerId,
    projectName: p.contract?.projectName ?? "Untitled project",
    amount: Number(p.amount),
    revenueAmount: p.revenueAmount != null ? Number(p.revenueAmount) : null,
    workCostAmount: p.workCostAmount != null ? Number(p.workCostAmount) : null,
    projectExpensesAmount:
      p.projectExpensesAmount != null ? Number(p.projectExpensesAmount) : null,
    profitAmount: p.profitAmount != null ? Number(p.profitAmount) : null,
    sharePercentageUsed:
      p.sharePercentageUsed != null ? Number(p.sharePercentageUsed) : null,
  }));
}
