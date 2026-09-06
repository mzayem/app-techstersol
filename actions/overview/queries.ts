import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { getRatesToPkr } from "@/lib/fx/rates";

export type MonthlyPoint = {
  /** First day of the month, as an ISO date string (YYYY-MM-DD). */
  month: string;
  earning: number;
  expense: number;
  lifestyle: number;
  investment: number;
  emergencyFund: number;
  donation: number;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Net earning, expenses (by category), and donations grouped by calendar
 * month across all recorded history. Small enough in practice (an internal
 * company's transaction history) to aggregate in JS rather than a raw
 * date_trunc query, consistent with the rest of this codebase. */
export async function getMonthlySeries(): Promise<MonthlyPoint[]> {
  const [earnings, expenses, donations] = await Promise.all([
    prisma.earning.findMany({ select: { date: true, amount: true, teamPay: true } }),
    prisma.expense.findMany({ select: { date: true, amount: true, category: true } }),
    prisma.donation.findMany({ select: { date: true, amount: true } }),
  ]);

  const map = new Map<string, MonthlyPoint>();
  function bucket(date: Date) {
    const key = monthKey(date);
    let point = map.get(key);
    if (!point) {
      point = {
        month: key,
        earning: 0,
        expense: 0,
        lifestyle: 0,
        investment: 0,
        emergencyFund: 0,
        donation: 0,
      };
      map.set(key, point);
    }
    return point;
  }

  for (const e of earnings) {
    bucket(e.date).earning += Number(e.amount) - Number(e.teamPay);
  }
  for (const e of expenses) {
    const point = bucket(e.date);
    const amount = Number(e.amount);
    if (e.category === "EXPENSE") point.expense += amount;
    else if (e.category === "LIFESTYLE") point.lifestyle += amount;
    else if (e.category === "INVESTMENT") point.investment += amount;
    else if (e.category === "EMERGENCY_FUND") point.emergencyFund += amount;
  }
  for (const d of donations) {
    bucket(d.date).donation += Number(d.amount);
  }

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export type OverviewKpis = {
  currentMonthEarning: number;
  avgMonthlyEarning: number;
  totalEarning: number;
  totalExpenses: number;
  totalDonations: number;
  unpaidInvoiceCount: number;
  /** Invoices/contracts carry their own currency and this app keeps no FX
   * rate anywhere, so pending payments are reported per currency rather
   * than blended into one (misleading) total. */
  pendingByCurrency: Partial<Record<PaymentCurrency, number>>;
};

export function computeEarningKpis(series: MonthlyPoint[]) {
  const now = new Date();
  const currentKey = monthKey(now);
  const currentMonthEarning = series.find((p) => p.month === currentKey)?.earning ?? 0;

  const thisYearPrefix = `${now.getFullYear()}-`;
  const thisYearSeries = series.filter((p) => p.month.startsWith(thisYearPrefix));
  const yearEarning = thisYearSeries.reduce((sum, p) => sum + p.earning, 0);
  const activeMonthsThisYear = thisYearSeries.filter((p) => p.earning !== 0).length;
  const avgMonthlyEarning = activeMonthsThisYear > 0 ? yearEarning / activeMonthsThisYear : 0;

  const totalExpenses = series.reduce(
    (sum, p) => sum + p.expense + p.lifestyle + p.investment + p.emergencyFund,
    0,
  );
  const totalDonations = series.reduce((sum, p) => sum + p.donation, 0);
  const totalInvestment = series.reduce((sum, p) => sum + p.investment, 0);

  return {
    currentMonthEarning,
    /** Net earning so far this calendar year. */
    totalEarning: yearEarning,
    totalExpenses,
    totalDonations,
    totalInvestment,
    /** Average monthly net earning across this calendar year's active months. */
    avgMonthlyEarning,
  };
}

/** Balance due on every unpaid invoice, plus — for every contract that
 * isn't fully paid off yet (PENDING_PAYMENT or PARTIALLY_PAID) — whatever
 * part of its remaining balance has no outstanding invoice covering it.
 * That split avoids double-counting: an amount already sitting on an
 * unpaid invoice is counted once, via the invoice side. */
export async function getPendingPayments(): Promise<{
  unpaidInvoiceCount: number;
  pendingByCurrency: Partial<Record<PaymentCurrency, number>>;
  pendingTotalPkr: number;
}> {
  const pendingByCurrency: Partial<Record<PaymentCurrency, number>> = {};
  const add = (currency: PaymentCurrency, amount: number) => {
    if (amount <= 0.01) return;
    pendingByCurrency[currency] = (pendingByCurrency[currency] ?? 0) + amount;
  };

  const [unpaidInvoices, openContracts, ratesToPkr] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "UNPAID" },
      select: { currency: true, discount: true, items: { select: { amount: true } } },
    }),
    prisma.contract.findMany({
      where: { status: { in: ["PENDING_PAYMENT", "PARTIALLY_PAID"] } },
      select: {
        currency: true,
        paymentType: true,
        amount: true,
        milestones: { select: { amount: true } },
        invoiceItems: { select: { amount: true, invoice: { select: { status: true } } } },
      },
    }),
    getRatesToPkr(),
  ]);

  for (const invoice of unpaidInvoices) {
    const total = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    add(invoice.currency as PaymentCurrency, total - Number(invoice.discount));
  }

  for (const contract of openContracts) {
    const totalBillable =
      contract.paymentType === "PROJECT"
        ? Number(contract.amount ?? 0)
        : contract.milestones.reduce((sum, m) => sum + Number(m.amount), 0);
    let paid = 0;
    let unpaidInvoiced = 0;
    for (const item of contract.invoiceItems) {
      const amount = Number(item.amount);
      if (item.invoice.status === "PAID") paid += amount;
      else unpaidInvoiced += amount;
    }
    add(contract.currency as PaymentCurrency, totalBillable - paid - unpaidInvoiced);
  }

  const pendingTotalPkr = Object.entries(pendingByCurrency).reduce(
    (sum, [currency, amount]) => sum + amount * ratesToPkr[currency as PaymentCurrency],
    0,
  );

  return { unpaidInvoiceCount: unpaidInvoices.length, pendingByCurrency, pendingTotalPkr };
}

export type ClientRevenueSlice = {
  clientId: string;
  clientName: string;
  revenue: number;
  projectCount: number;
};

/** Revenue per client in PKR (via the Earning row each paid invoice
 * created — the one place a converted, comparable amount is recorded),
 * alongside how many contracts (projects) that client has. Only clients
 * with recorded revenue are included. */
export async function getClientRevenueBreakdown(): Promise<ClientRevenueSlice[]> {
  const [earningsByClient, contractCounts] = await Promise.all([
    prisma.earning.findMany({
      where: { invoiceId: { not: null } },
      select: {
        amount: true,
        invoice: { select: { clientId: true, client: { select: { name: true } } } },
      },
    }),
    prisma.contract.groupBy({ by: ["clientId"], _count: { _all: true } }),
  ]);

  const projectCountByClient = new Map(contractCounts.map((c) => [c.clientId, c._count._all]));

  const revenueByClient = new Map<string, ClientRevenueSlice>();
  for (const row of earningsByClient) {
    if (!row.invoice) continue;
    const { clientId, client } = row.invoice;
    const existing = revenueByClient.get(clientId);
    if (existing) {
      existing.revenue += Number(row.amount);
    } else {
      revenueByClient.set(clientId, {
        clientId,
        clientName: client.name,
        revenue: Number(row.amount),
        projectCount: projectCountByClient.get(clientId) ?? 0,
      });
    }
  }

  return [...revenueByClient.values()]
    .filter((slice) => slice.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

export type IncompleteContract = {
  id: string;
  clientName: string;
  projectName: string;
  deadline: Date;
  currency: PaymentCurrency;
  amount: number;
  status: string;
};

/** Every contract that hasn't reached COMPLETED yet, for the overview's
 * follow-up table. */
export async function getIncompleteContracts(): Promise<IncompleteContract[]> {
  const contracts = await prisma.contract.findMany({
    where: { status: { not: "COMPLETED" } },
    select: {
      id: true,
      projectName: true,
      deadline: true,
      currency: true,
      paymentType: true,
      amount: true,
      status: true,
      client: { select: { name: true } },
      milestones: { select: { amount: true } },
    },
    orderBy: { deadline: "asc" },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    clientName: contract.client.name,
    projectName: contract.projectName,
    deadline: contract.deadline,
    currency: contract.currency as PaymentCurrency,
    amount:
      contract.paymentType === "PROJECT"
        ? Number(contract.amount ?? 0)
        : contract.milestones.reduce((sum, m) => sum + Number(m.amount), 0),
    status: contract.status,
  }));
}
