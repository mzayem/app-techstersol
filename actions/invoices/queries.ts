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

/** Data needed to populate the "add invoice" dialog: every client, every
 * contract (with its milestones, for line-item generation), and every bank
 * account (for the currency-matched default). */
export async function listInvoiceSources() {
  const [clients, contracts, bankAccounts] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.contract.findMany({
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

  return { clients, contracts, bankAccounts };
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
