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
  const contracts = await prisma.contract.findMany({
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

  const paidAmounts = await paidAmountsByContract(contracts.map((c) => c.id));

  return contracts.map((contract) => ({
    ...contract,
    paidAmount: paidAmounts.get(contract.id) ?? 0,
  }));
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
    paid.set(item.contractId!, (paid.get(item.contractId!) ?? 0) + Number(item.amount));
  }
  return paid;
}

export async function listClientOptions() {
  return prisma.client.findMany({
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}
