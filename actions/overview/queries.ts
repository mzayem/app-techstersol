import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { CONTRACT_STATUSES_EXCLUDED_FROM_PENDING } from "@/lib/contracts/constants";
import { DISTRIBUTION_SPLIT } from "@/lib/finance/constants";
import { getRatesToPkr } from "@/lib/fx/rates";
import type { ResolvedPeriod } from "@/lib/overview/period";

export type MonthlyPoint = {
  /** First day of the month, as an ISO date string (YYYY-MM-DD). */
  month: string;
  earning: number;
  expense: number;
  lifestyle: number;
  investment: number;
  emergencyFund: number;
  donation: number;
  /** Standalone TeamPayment amounts only — team pay already netted out of
   * `earning` via Earning.teamPay is not repeated here. */
  teamPaid: number;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Net earning, expenses (by category), and donations grouped by calendar
 * month across all recorded history. Small enough in practice (an internal
 * company's transaction history) to aggregate in JS rather than a raw
 * date_trunc query, consistent with the rest of this codebase. Fetched
 * unscoped so the area chart can still zoom to any window locally; period
 * scoping for the KPI cards happens afterward, on this same array. */
export async function getMonthlySeries(): Promise<MonthlyPoint[]> {
  const [earnings, expenses, donations, teamPayments] = await Promise.all([
    prisma.earning.findMany({
      select: { date: true, amount: true, teamPay: true },
    }),
    prisma.expense.findMany({
      select: { date: true, amount: true, category: true },
    }),
    prisma.donation.findMany({ select: { date: true, amount: true } }),
    prisma.teamPayment.findMany({ select: { date: true, amount: true } }),
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
        teamPaid: 0,
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
  for (const t of teamPayments) {
    bucket(t.date).teamPaid += Number(t.amount);
  }

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function withinPeriod(month: string, period: ResolvedPeriod) {
  const date = new Date(`${month}T00:00:00`);
  return date >= monthFloor(period.from) && date <= period.to;
}

function monthFloor(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** p.earning is already net of each Earning row's own teamPay; subtracting
 * teamPaid nets out the standalone TeamPayment rows too (payslips not tied
 * to a specific earning), so the result is fully net — the same "net
 * earning" the Distributions page and Balance Sheet report. */
function netPeriodEarning(periodSeries: MonthlyPoint[]) {
  const grossEarning = periodSeries.reduce((sum, p) => sum + p.earning, 0);
  const teamPaid = periodSeries.reduce((sum, p) => sum + p.teamPaid, 0);
  return { teamPaid, netEarning: grossEarning - teamPaid };
}

export function computeEarningKpis(
  series: MonthlyPoint[],
  period: ResolvedPeriod,
) {
  const periodSeries = series.filter((p) => withinPeriod(p.month, period));

  const { teamPaid, netEarning: periodEarning } = netPeriodEarning(periodSeries);
  const activeMonths = periodSeries.filter((p) => p.earning !== 0).length;
  const avgMonthlyEarning = activeMonths > 0 ? periodEarning / activeMonths : 0;

  // Investment gets its own KPI card and audit, so it's excluded here to
  // avoid double-counting it under "Total expenses" too.
  const totalExpenses = periodSeries.reduce(
    (sum, p) => sum + p.expense + p.lifestyle + p.emergencyFund,
    0,
  );
  const totalDonations = periodSeries.reduce((sum, p) => sum + p.donation, 0);
  const totalInvestment = periodSeries.reduce(
    (sum, p) => sum + p.investment,
    0,
  );

  return {
    /** Net earning across the selected period. */
    periodEarning,
    /** Average monthly net earning across the period's active months. */
    avgMonthlyEarning,
    totalExpenses,
    totalDonations,
    totalInvestment,
    /** Standalone team payments (not already netted via Earning.teamPay). */
    totalTeamPaid: teamPaid,
    monthCount: periodSeries.length,
  };
}

export type BucketAudit = {
  spent: number;
  allocated: number;
  /** (spent - allocated) / allocated, as a fraction. Positive = over budget. */
  overFraction: number | null;
  /** For a bucket that's really a sum of several — e.g. "Total expenses" is
   * Expense + Lifestyle + Emergency fund — the individual amounts behind
   * `spent`, for a tooltip to break down. Omitted for single-bucket audits. */
  breakdown?: { label: string; value: number }[];
};

function auditBucket(
  spent: number,
  periodEarning: number,
  splitFractions: number[],
  breakdown?: { label: string; value: number }[],
): BucketAudit {
  const allocated = periodEarning * splitFractions.reduce((a, b) => a + b, 0);
  const overFraction = allocated > 0 ? (spent - allocated) / allocated : null;
  return { spent, allocated, overFraction, breakdown };
}

/** How each bucket's actual spend compares to its allocated share of net
 * earning (per lib/finance/constants' DISTRIBUTION_SPLIT) across the
 * selected period — powers the over/under-budget indicators on the
 * Expenses, Investment, and Donation KPI cards. */
export function getDistributionAudit(
  series: MonthlyPoint[],
  period: ResolvedPeriod,
) {
  const periodSeries = series.filter((p) => withinPeriod(p.month, period));
  const { netEarning: periodEarning } = netPeriodEarning(periodSeries);

  const expensePart = periodSeries.reduce((sum, p) => sum + p.expense, 0);
  const lifestylePart = periodSeries.reduce((sum, p) => sum + p.lifestyle, 0);
  const emergencyPart = periodSeries.reduce(
    (sum, p) => sum + p.emergencyFund,
    0,
  );
  const expenseSpent = expensePart + lifestylePart + emergencyPart;
  const investmentSpent = periodSeries.reduce(
    (sum, p) => sum + p.investment,
    0,
  );
  const donationSpent = periodSeries.reduce((sum, p) => sum + p.donation, 0);

  return {
    expenses: auditBucket(
      expenseSpent,
      periodEarning,
      [
        DISTRIBUTION_SPLIT.EXPENSE,
        DISTRIBUTION_SPLIT.LIFESTYLE,
        DISTRIBUTION_SPLIT.EMERGENCY_FUND,
      ],
      [
        { label: "Expenses", value: expensePart },
        { label: "Lifestyle", value: lifestylePart },
        { label: "Emergency fund", value: emergencyPart },
      ],
    ),
    investment: auditBucket(investmentSpent, periodEarning, [
      DISTRIBUTION_SPLIT.INVESTMENT,
    ]),
    donation: auditBucket(donationSpent, periodEarning, [
      DISTRIBUTION_SPLIT.DONATION,
    ]),
  };
}

/** Balance due on every unpaid invoice, plus — for every contract that
 * isn't fully paid off yet (PENDING_PAYMENT or PARTIALLY_PAID) — whatever
 * part of its remaining balance has no outstanding invoice covering it.
 * That split avoids double-counting: an amount already sitting on an
 * unpaid invoice is counted once, via the invoice side. Always all-time —
 * an outstanding balance doesn't stop being outstanding because the
 * calendar page turned, so this ignores the overview's period selector.
 *
 * A PAUSED or CANCELLED contract is excluded from both sides: its own
 * status already falls outside PENDING_PAYMENT/PARTIALLY_PAID, and any
 * invoice line still billed against it is skipped too, so pausing or
 * cancelling a project drops it out of "pending payments" immediately. */
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
      select: {
        currency: true,
        discount: true,
        items: {
          select: {
            amount: true,
            contract: { select: { status: true } },
          },
        },
      },
    }),
    prisma.contract.findMany({
      where: { status: { in: ["PENDING_PAYMENT", "PARTIALLY_PAID"] } },
      select: {
        currency: true,
        paymentType: true,
        amount: true,
        milestones: { select: { amount: true } },
        invoiceItems: {
          select: { amount: true, invoice: { select: { status: true } } },
        },
      },
    }),
    getRatesToPkr(),
  ]);

  const isExcludedStatus = (status: string) =>
    (CONTRACT_STATUSES_EXCLUDED_FROM_PENDING as readonly string[]).includes(
      status,
    );

  for (const invoice of unpaidInvoices) {
    const total = invoice.items.reduce((sum, item) => {
      if (item.contract && isExcludedStatus(item.contract.status)) return sum;
      return sum + Number(item.amount);
    }, 0);
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
    add(
      contract.currency as PaymentCurrency,
      totalBillable - paid - unpaidInvoiced,
    );
  }

  const pendingTotalPkr = Object.entries(pendingByCurrency).reduce(
    (sum, [currency, amount]) =>
      sum + amount * ratesToPkr[currency as PaymentCurrency],
    0,
  );

  return {
    unpaidInvoiceCount: unpaidInvoices.length,
    pendingByCurrency,
    pendingTotalPkr,
  };
}

/** Team pay (PKR) still owed to the team: outsourced contracts that haven't
 * completed yet, plus every logged work diary week's amount (there's no
 * "paid" flag on a diary entry yet, so a logged hourly week counts as owed
 * until a payslip is issued for it by hand). As opposed to client-side
 * pending payments (money owed to the company). Always all-time, same
 * reasoning as getPendingPayments — and, same as there, a PAUSED or
 * CANCELLED contract's teamPayAmount is excluded since no payment is
 * expected on it while it stays in that status. */
export async function getTeamPendingPayments(): Promise<number> {
  const [openOutsourced, diarySum] = await Promise.all([
    prisma.contract.findMany({
      where: {
        teamMemberId: { not: null },
        status: {
          notIn: ["COMPLETED", ...CONTRACT_STATUSES_EXCLUDED_FROM_PENDING],
        },
      },
      select: { teamPayAmount: true },
    }),
    prisma.workDiaryEntry.aggregate({ _sum: { amount: true } }),
  ]);
  const contractPending = openOutsourced.reduce(
    (sum, c) => sum + Number(c.teamPayAmount ?? 0),
    0,
  );
  return contractPending + Number(diarySum._sum.amount ?? 0);
}

export const OTHER_REVENUE_CLIENT_ID = "__other__";

export type ClientRevenueSlice = {
  clientId: string;
  clientName: string;
  revenue: number;
  projectCount: number;
  /** True only for the synthetic "Other" slice — an Earning not tied to any
   * client invoice (entered by hand, with no contract behind it), so there's
   * no client or project count to attribute it to. */
  isOther?: boolean;
};

/** Revenue per client in PKR (via the Earning row each paid invoice
 * created — the one place a converted, comparable amount is recorded) for
 * the selected period, alongside how many contracts (projects) that
 * client has overall, plus a catch-all "Other" slice for earnings with no
 * invoice behind them at all. Only slices with recorded revenue are
 * included. */
export async function getClientRevenueBreakdown(
  period: ResolvedPeriod,
): Promise<ClientRevenueSlice[]> {
  const [earnings, contractCounts] = await Promise.all([
    prisma.earning.findMany({
      where: { date: { gte: period.from, lte: period.to } },
      select: {
        amount: true,
        invoice: {
          select: { clientId: true, client: { select: { name: true } } },
        },
      },
    }),
    prisma.contract.groupBy({ by: ["clientId"], _count: { _all: true } }),
  ]);

  const projectCountByClient = new Map(
    contractCounts.map((c) => [c.clientId, c._count._all]),
  );

  const revenueByClient = new Map<string, ClientRevenueSlice>();
  let otherRevenue = 0;
  for (const row of earnings) {
    if (!row.invoice) {
      otherRevenue += Number(row.amount);
      continue;
    }
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

  const slices = [...revenueByClient.values()].filter(
    (slice) => slice.revenue > 0,
  );
  if (otherRevenue > 0) {
    slices.push({
      clientId: OTHER_REVENUE_CLIENT_ID,
      clientName: "Other",
      revenue: otherRevenue,
      projectCount: 0,
      isOther: true,
    });
  }

  return slices.sort((a, b) => b.revenue - a.revenue);
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

/** Every contract that hasn't reached COMPLETED yet and started within the
 * selected period, for the overview's follow-up table. */
export async function getIncompleteContracts(
  period: ResolvedPeriod,
): Promise<IncompleteContract[]> {
  const contracts = await prisma.contract.findMany({
    where: {
      status: { not: "COMPLETED" },
      date: { gte: period.from, lte: period.to },
    },
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
