import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import type { ContractPaymentType, ContractStatus } from "@/lib/contracts/constants";

export type ClientOverview = {
  totalProjects: number;
  completedProjects: number;
  pendingProjects: number;
  pendingPaymentByCurrency: Partial<Record<PaymentCurrency, number>>;
  nextDueInvoice: {
    number: number;
    dueDate: Date;
    currency: PaymentCurrency;
    amount: number;
  } | null;
};

/** From the client's own point of view: a project counts as "pending"
 * unless it's finished or called off — unlike the internal forecasting
 * KPIs, a paused project still reads as pending here, since the client
 * still expects it to resume. */
export async function getClientOverview(clientId: string): Promise<ClientOverview> {
  const [contracts, unpaidInvoices, nextDue] = await Promise.all([
    prisma.contract.findMany({
      where: { clientId },
      select: { status: true },
    }),
    prisma.invoice.findMany({
      where: { clientId, status: "UNPAID" },
      select: {
        currency: true,
        discount: true,
        items: { select: { amount: true } },
      },
    }),
    prisma.invoice.findFirst({
      where: { clientId, status: "UNPAID" },
      orderBy: { dueDate: "asc" },
      select: {
        number: true,
        dueDate: true,
        currency: true,
        discount: true,
        items: { select: { amount: true } },
      },
    }),
  ]);

  const completedProjects = contracts.filter((c) => c.status === "COMPLETED").length;
  const pendingProjects = contracts.filter(
    (c) => c.status !== "COMPLETED" && c.status !== "CANCELLED",
  ).length;

  const pendingPaymentByCurrency: Partial<Record<PaymentCurrency, number>> = {};
  for (const invoice of unpaidInvoices) {
    const total = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = total - Number(invoice.discount);
    if (balance <= 0.01) continue;
    const currency = invoice.currency as PaymentCurrency;
    pendingPaymentByCurrency[currency] = (pendingPaymentByCurrency[currency] ?? 0) + balance;
  }

  const nextDueInvoice = nextDue
    ? {
        number: nextDue.number,
        dueDate: nextDue.dueDate,
        currency: nextDue.currency as PaymentCurrency,
        amount:
          nextDue.items.reduce((sum, item) => sum + Number(item.amount), 0) -
          Number(nextDue.discount),
      }
    : null;

  return {
    totalProjects: contracts.length,
    completedProjects,
    pendingProjects,
    pendingPaymentByCurrency,
    nextDueInvoice,
  };
}

export type MyContract = {
  id: string;
  projectName: string;
  description: string | null;
  date: Date;
  deadline: Date;
  currency: PaymentCurrency;
  paymentType: ContractPaymentType;
  amount: number | null;
  status: ContractStatus;
  milestones: { id: string; name: string; amount: number; deadline: Date }[];
};

export async function listMyContracts(clientId: string): Promise<MyContract[]> {
  const contracts = await prisma.contract.findMany({
    where: { clientId },
    select: {
      id: true,
      projectName: true,
      description: true,
      date: true,
      deadline: true,
      currency: true,
      paymentType: true,
      amount: true,
      status: true,
      milestones: { select: { id: true, name: true, amount: true, deadline: true } },
    },
    orderBy: { date: "desc" },
  });

  return contracts.map((c) => ({
    ...c,
    currency: c.currency as PaymentCurrency,
    paymentType: c.paymentType as ContractPaymentType,
    status: c.status as ContractStatus,
    amount: c.amount === null ? null : Number(c.amount),
    milestones: c.milestones.map((m) => ({ ...m, amount: Number(m.amount) })),
  }));
}

export type MyInvoice = {
  id: string;
  number: number;
  currency: PaymentCurrency;
  issueDate: Date;
  dueDate: Date;
  status: "UNPAID" | "PAID";
  paidOn: Date | null;
  total: number;
  balanceDue: number;
};

export async function listMyInvoices(clientId: string): Promise<MyInvoice[]> {
  const invoices = await prisma.invoice.findMany({
    where: { clientId },
    select: {
      id: true,
      number: true,
      currency: true,
      discount: true,
      issueDate: true,
      dueDate: true,
      status: true,
      paidOn: true,
      items: { select: { amount: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  return invoices.map((invoice) => {
    const total = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      id: invoice.id,
      number: invoice.number,
      currency: invoice.currency as PaymentCurrency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status as "UNPAID" | "PAID",
      paidOn: invoice.paidOn,
      total,
      balanceDue: total - Number(invoice.discount),
    };
  });
}
