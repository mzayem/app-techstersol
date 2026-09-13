import { prisma } from "@/lib/prisma";
import type { ContractStatus } from "@/lib/contracts/constants";
import { dateWhere, type DateRange } from "@/lib/finance/date-range";

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
  /** Filters by the contract's start `date` — omit for no date filtering. */
  dateRange?: DateRange;
};

function orderBy(sort: SortOption | undefined) {
  switch (sort) {
    case "date-asc":
      return [{ date: "asc" as const }];
    case "deadline-desc":
      return [{ deadline: "desc" as const }];
    case "name-asc":
      return [{ projectName: "asc" as const }];
    case "name-desc":
      return [{ projectName: "desc" as const }];
    case "date-desc":
      return [{ date: "desc" as const }];
    case "deadline-asc":
    default:
      // Default view: soonest deadline first, newest as a tiebreak.
      return [{ deadline: "asc" as const }, { date: "desc" as const }];
  }
}

/** The default view (no sort explicitly chosen, or "deadline soonest"
 * explicitly picked) additionally floats non-completed projects above
 * completed ones — active/working contracts are what you're checking on,
 * finished ones are just history. Any other explicit sort (by name, by
 * start date) is left as a plain flat sort with no grouping. */
function groupsActiveFirst(sort: SortOption | undefined) {
  return sort === undefined || sort === "deadline-asc";
}

function sortActiveFirst<T extends { status: string }>(contracts: T[]): T[] {
  const active = contracts.filter((c) => c.status !== "COMPLETED");
  const completed = contracts.filter((c) => c.status === "COMPLETED");
  return [...active, ...completed];
}

export async function listContracts(filters: ListFilters) {
  const contracts = await prisma.contract.findMany({
    where: {
      status: filters.status,
      date: filters.dateRange ? dateWhere(filters.dateRange) : undefined,
      OR: filters.search
        ? [
            { projectName: { contains: filters.search, mode: "insensitive" } },
            {
              client: {
                name: { contains: filters.search, mode: "insensitive" },
              },
            },
          ]
        : undefined,
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      milestones: { orderBy: { deadline: "asc" } },
    },
    orderBy: orderBy(filters.sort),
  });

  const paidAmounts = await paidAmountsByContract(contracts.map((c) => c.id));

  const withPaidAmount = contracts.map((contract) => ({
    ...contract,
    paidAmount: paidAmounts.get(contract.id) ?? 0,
  }));

  return groupsActiveFirst(filters.sort)
    ? sortActiveFirst(withPaidAmount)
    : withPaidAmount;
}

/** Sum of PAID invoice items billed against each contract, regardless of
 * which milestone (if any) they came from — used to show how much of a
 * partially/upfront-paid contract has actually been received. */
async function paidAmountsByContract(contractIds: string[]) {
  const paid = new Map<string, number>();
  if (contractIds.length === 0) return paid;

  const items = await prisma.invoiceItem.findMany({
    where: { contractId: { in: contractIds }, invoice: { status: "PAID" } },
    select: { contractId: true, amount: true },
  });
  for (const item of items) {
    paid.set(
      item.contractId!,
      (paid.get(item.contractId!) ?? 0) + Number(item.amount),
    );
  }
  return paid;
}

export async function listClientOptions() {
  return prisma.client.findMany({
    select: { id: true, name: true, currency: true, emailNotificationsEnabled: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}

/** Contracts that have a team member assigned — the candidates for a
 * payslip's optional "assigned project" field. */
export async function listOutsourcedContractOptions() {
  return prisma.contract.findMany({
    where: { teamMemberId: { not: null } },
    select: { id: true, projectName: true, teamMemberId: true },
    orderBy: { date: "desc" },
  });
}
