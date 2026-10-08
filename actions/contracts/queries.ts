import { prisma } from "@/lib/prisma";
import type { ContractStatus } from "@/lib/contracts/constants";
import { dateWhere, type DateRange } from "@/lib/finance/date-range";

export type SortOption =
  | "deadline-asc"
  | "deadline-desc"
  | "next-invoice-asc"
  | "updated-desc"
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc";

export type ListFilters = {
  /** "project" (the Contracts page: fixed-price and hourly) or "recurring"
   * (the Recurring Contracts page). */
  kind?: "project" | "recurring";
  search?: string;
  status?: ContractStatus;
  /** Omit for the default grouped view (see `sortDefaultView`); any
   * explicit sort is applied flat across every status. */
  sort?: SortOption;
  /** Filters by the contract's start `date` — omit for no date filtering. */
  dateRange?: DateRange;
};

const NEWEST = { createdAt: "desc" as const };
const OLDEST = { createdAt: "asc" as const };

function orderBy(sort: SortOption | undefined, kind: "project" | "recurring") {
  if (!sort && kind === "recurring") {
    // Default recurring view: whichever bills next comes first.
    return [
      { nextInvoiceDate: { sort: "asc" as const, nulls: "last" as const } },
      NEWEST,
    ];
  }
  switch (sort) {
    case "next-invoice-asc":
      return [
        { nextInvoiceDate: { sort: "asc" as const, nulls: "last" as const } },
        NEWEST,
      ];
    case "date-asc":
      return [{ date: "asc" as const }, OLDEST];
    case "deadline-desc":
      return [
        { deadline: { sort: "desc" as const, nulls: "last" as const } },
        NEWEST,
      ];
    case "updated-desc":
      return [{ updatedAt: "desc" as const }, NEWEST];
    case "name-asc":
      return [{ projectName: "asc" as const }, NEWEST];
    case "name-desc":
      return [{ projectName: "desc" as const }, NEWEST];
    case "date-desc":
      return [{ date: "desc" as const }, NEWEST];
    case "deadline-asc":
    default:
      // Soonest deadline first, newest as a tiebreak.
      return [
        { deadline: { sort: "asc" as const, nulls: "last" as const } },
        { date: "desc" as const },
        NEWEST,
      ];
  }
}

/** Statuses that mean the project is finished — no deadline to chase. */
const CLOSED_STATUSES: readonly string[] = ["COMPLETED", "CANCELLED"];

/** The default view (no sort explicitly chosen): open contracts first by
 * soonest deadline — or next invoice date, on the recurring page — as
 * already ordered by the query, then completed and
 * cancelled ones by most recently modified — finished projects are just
 * history, so their deadline no longer matters. Any explicit sort from the
 * dropdown skips this grouping and applies flat across every status. */
function sortDefaultView<T extends { status: string; updatedAt: Date }>(
  contracts: T[],
): T[] {
  const open = contracts.filter((c) => !CLOSED_STATUSES.includes(c.status));
  const closed = contracts
    .filter((c) => CLOSED_STATUSES.includes(c.status))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return [...open, ...closed];
}

/** "101" or "#101" also finds contract #101. */
function contractNumberMatch(search: string) {
  const digits = search.trim().replace(/^#/, "");
  return /^\d{1,9}$/.test(digits) ? [{ number: Number(digits) }] : [];
}

export async function listContracts(filters: ListFilters) {
  const kind = filters.kind ?? "project";
  const contracts = await prisma.contract.findMany({
    where: {
      paymentType: kind === "recurring" ? "RECURRING" : { not: "RECURRING" },
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
            ...contractNumberMatch(filters.search),
          ]
        : undefined,
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      milestones: { orderBy: { deadline: "asc" } },
      projectExpenses: { orderBy: { date: "asc" } },
    },
    orderBy: orderBy(filters.sort, kind),
  });

  const [paidAmounts, unbilledHours] = await Promise.all([
    paidAmountsByContract(contracts.map((c) => c.id)),
    unbilledHoursByContract(
      contracts.filter((c) => c.paymentType === "HOURLY").map((c) => c.id),
    ),
  ]);

  const withPaidAmount = contracts.map((contract) => ({
    ...contract,
    paidAmount: paidAmounts.get(contract.id) ?? 0,
    unbilledHours: unbilledHours.get(contract.id) ?? 0,
  }));

  return filters.sort ? withPaidAmount : sortDefaultView(withPaidAmount);
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

/** Logged hours not yet on any invoice, per HOURLY contract. */
async function unbilledHoursByContract(contractIds: string[]) {
  const hours = new Map<string, number>();
  if (contractIds.length === 0) return hours;
  const rows = await prisma.contractHourLog.groupBy({
    by: ["contractId"],
    where: { contractId: { in: contractIds }, invoiceItemId: null },
    _sum: { hours: true },
  });
  for (const row of rows)
    hours.set(row.contractId, Number(row._sum.hours ?? 0));
  return hours;
}

/** Bank accounts an hourly/recurring contract's invoices can be issued
 * against. */
export async function listBankAccountOptions() {
  return prisma.bankAccount.findMany({
    select: {
      id: true,
      currency: true,
      bankName: true,
      accountHolderName: true,
    },
    orderBy: { bankName: "asc" },
  });
}

export async function listClientOptions() {
  return prisma.client.findMany({
    select: {
      id: true,
      name: true,
      currency: true,
      emailNotificationsEnabled: true,
    },
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

/** Own tiny query for the contract form's partner combobox — deliberately
 * not imported from actions/partners/* (owned by a separate, concurrent
 * change to that module) to avoid a merge conflict. */
export async function listPartnerOptions() {
  return prisma.partner.findMany({
    select: { id: true, name: true, sharePercentage: true, currency: true },
    orderBy: { name: "asc" },
  });
}

/** A contract's project-level expense rows — used to seed the "Project
 * Expenses" section of the edit dialog. */
export async function listProjectExpenses(contractId: string) {
  return prisma.projectExpense.findMany({
    where: { contractId },
    orderBy: { date: "asc" },
  });
}
