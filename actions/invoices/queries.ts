import { prisma } from "@/lib/prisma";
import type { InvoiceStatus } from "@/lib/invoices/constants";

export type SortOption = "number-desc" | "number-asc" | "due-asc" | "due-desc";

export type ListFilters = {
  search?: string;
  status?: InvoiceStatus;
  sort?: SortOption;
};

function orderBy(sort: SortOption | undefined) {
  switch (sort) {
    case "number-asc":
      return { number: "asc" as const };
    case "due-asc":
      return { dueDate: "asc" as const };
    case "due-desc":
      return { dueDate: "desc" as const };
    case "number-desc":
    default:
      return { number: "desc" as const };
  }
}

export async function listInvoices(filters: ListFilters) {
  return prisma.invoice.findMany({
    where: {
      status: filters.status,
      client: filters.search
        ? { name: { contains: filters.search, mode: "insensitive" } }
        : undefined,
    },
    include: {
      client: { select: { id: true, name: true } },
      bankAccount: { select: { bankName: true } },
      items: true,
    },
    orderBy: orderBy(filters.sort),
  });
}

/** Groups paid InvoiceItem amounts by their source contract/milestone, keyed
 * the same way as remainingKey() below, so callers can subtract what's
 * already been paid from a contract or milestone's face amount. */
async function paidAmountsByLine(contractIds: string[]) {
  if (contractIds.length === 0) return new Map<string, number>();

  const paidItems = await prisma.invoiceItem.findMany({
    where: {
      contractId: { in: contractIds },
      invoice: { status: "PAID" },
    },
    select: { contractId: true, milestoneId: true, amount: true },
  });

  const paid = new Map<string, number>();
  for (const item of paidItems) {
    const key = remainingKey(item.contractId!, item.milestoneId);
    paid.set(key, (paid.get(key) ?? 0) + Number(item.amount));
  }
  return paid;
}

export function remainingKey(contractId: string, milestoneId: string | null) {
  return `${contractId}:${milestoneId ?? "project"}`;
}

/** Data needed to populate the "add invoice" dialog: every client, every
 * not-yet-fully-paid billable line (a project's remaining balance, or one
 * milestone's remaining balance — milestones are listed individually so a
 * milestone contract behaves like several selectable contracts), and every
 * bank account (for the currency-matched default). */
export async function listInvoiceSources() {
  const [clients, contracts, bankAccounts] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.contract.findMany({
      where: { status: { not: "COMPLETED" } },
      select: {
        id: true,
        clientId: true,
        projectName: true,
        currency: true,
        paymentType: true,
        amount: true,
        milestones: { select: { id: true, name: true, amount: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.bankAccount.findMany({
      select: { id: true, currency: true, bankName: true, accountHolderName: true },
      orderBy: { bankName: "asc" },
    }),
  ]);

  const paid = await paidAmountsByLine(contracts.map((c) => c.id));

  const lineOptions = contracts.flatMap((contract) => {
    if (contract.paymentType === "PROJECT") {
      const total = contract.amount ? Number(contract.amount) : 0;
      const remaining = total - (paid.get(remainingKey(contract.id, null)) ?? 0);
      if (remaining <= 0.01) return [];
      return [
        {
          contractId: contract.id,
          milestoneId: null as string | null,
          clientId: contract.clientId,
          currency: contract.currency,
          label: contract.projectName,
          remainingAmount: remaining,
        },
      ];
    }
    return contract.milestones.flatMap((milestone) => {
      const remaining =
        Number(milestone.amount) - (paid.get(remainingKey(contract.id, milestone.id)) ?? 0);
      if (remaining <= 0.01) return [];
      return [
        {
          contractId: contract.id,
          milestoneId: milestone.id as string | null,
          clientId: contract.clientId,
          currency: contract.currency,
          label: `${contract.projectName} — ${milestone.name}`,
          remainingAmount: remaining,
        },
      ];
    });
  });

  return { clients, lineOptions, bankAccounts };
}

export async function getInvoiceForPdf(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      bankAccount: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
}

/** Public-safe fields only — no amounts or bank account numbers. */
export async function getInvoiceForVerification(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      currency: true,
      issueDate: true,
      dueDate: true,
      paidOn: true,
      transactionId: true,
      client: { select: { name: true } },
      bankAccount: { select: { bankName: true } },
      items: { select: { description: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return null;
  return {
    number: invoice.number,
    status: invoice.status as InvoiceStatus,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paidOn: invoice.paidOn,
    transactionId: invoice.transactionId,
    clientName: invoice.client.name,
    bankName: invoice.bankAccount.bankName,
    currency: invoice.currency,
    task: invoice.items.map((item) => item.description).join(", "),
  };
}
