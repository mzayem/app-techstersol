import { prisma } from "@/lib/prisma";
import type { InvoiceStatus } from "@/lib/invoices/constants";
import { dateWhere, type DateRange } from "@/lib/finance/date-range";

export type SortOption = "number-desc" | "number-asc" | "due-asc" | "due-desc";

export type ListFilters = {
  search?: string;
  status?: InvoiceStatus;
  sort?: SortOption;
  /** Filters by `issueDate` — omit for no date filtering. */
  dateRange?: DateRange;
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
      issueDate: filters.dateRange ? dateWhere(filters.dateRange) : undefined,
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

/** Groups InvoiceItem amounts by their source contract/milestone, keyed the
 * same way as remainingKey() below, so callers can subtract what's already
 * been invoiced from a contract or milestone's face amount. Counts every
 * existing invoice regardless of paid/unpaid status — an outstanding unpaid
 * invoice is still a claim on that balance, so a second invoice can't be
 * raised against the same amount while it's outstanding. Only deleting an
 * invoice (which cascades its items) frees the balance back up; marking one
 * unpaid does not. */
export async function invoicedAmountsByLine(contractIds: string[]) {
  if (contractIds.length === 0) return new Map<string, number>();

  const invoicedItems = await prisma.invoiceItem.findMany({
    where: { contractId: { in: contractIds } },
    select: { contractId: true, milestoneId: true, amount: true },
  });

  const invoiced = new Map<string, number>();
  for (const item of invoicedItems) {
    const key = remainingKey(item.contractId!, item.milestoneId);
    invoiced.set(key, (invoiced.get(key) ?? 0) + Number(item.amount));
  }
  return invoiced;
}

export function remainingKey(contractId: string, milestoneId: string | null) {
  return `${contractId}:${milestoneId ?? "project"}`;
}

/** Data needed to populate the "add invoice" dialog: every client, every
 * not-yet-fully-invoiced billable line (a project's remaining balance, or
 * one milestone's remaining balance, net of every existing invoice against
 * it whether paid or not — milestones are listed individually so a
 * milestone contract behaves like several selectable contracts), and every
 * bank account (for the currency-matched default). A line with nothing left
 * to invoice is omitted entirely rather than offered at Rs 0. */
export async function listInvoiceSources() {
  const [clients, contracts, bankAccounts] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
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
      select: {
        id: true,
        currency: true,
        bankName: true,
        accountHolderName: true,
      },
      orderBy: { bankName: "asc" },
    }),
  ]);

  const invoiced = await invoicedAmountsByLine(contracts.map((c) => c.id));

  const lineOptions = contracts.flatMap((contract) => {
    if (contract.paymentType === "PROJECT") {
      const total = contract.amount ? Number(contract.amount) : 0;
      const remaining =
        total - (invoiced.get(remainingKey(contract.id, null)) ?? 0);
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
        Number(milestone.amount) -
        (invoiced.get(remainingKey(contract.id, milestone.id)) ?? 0);
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
