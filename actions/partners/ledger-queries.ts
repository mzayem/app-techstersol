import { prisma } from "@/lib/prisma";
import { dateWhere, type DateRange } from "@/lib/finance/date-range";
import type { ContractStatus } from "@/lib/contracts/constants";

export type PartnerLedgerRow = {
  id: string;
  date: Date;
  partnerId: string;
  partnerName: string;
  projectName: string | null;
  /** Null for a payment not tied to a contract (e.g. a manual advance) — an
   * ended (COMPLETED) vs. still-open project is the "active" distinction. */
  contractStatus: ContractStatus | null;
  /** Project revenue (PKR) at the time the share was booked — null for a
   * MANUAL payment with no completed-contract snapshot behind it. */
  revenueAmount: number | null;
  workCostAmount: number | null;
  projectExpensesAmount: number | null;
  profitAmount: number | null;
  sharePercentageUsed: number | null;
  /** The partner's actual share/payment amount. */
  amount: number;
  /** Whether a PartnerPayslip has been issued for this payment yet. */
  issued: boolean;
  payslipNumber: number | null;
};

export type PartnerLedgerFilters = {
  /** Filters by the payment's own `date` — omit for no date filtering. */
  dateRange?: DateRange;
  /** One or more partner ids to restrict to — omit (or empty) for every
   * partner. */
  partnerIds?: string[];
};

/** Every partner payment (booked automatically at contract completion, or
 * raised manually via a payslip) with its full cost breakdown — the
 * partner-side equivalent of the Balance Sheet's ledger table. Also the
 * data source behind the downloadable partner earnings report. */
export async function getPartnerLedger(
  filters: PartnerLedgerFilters = {},
): Promise<PartnerLedgerRow[]> {
  const payments = await prisma.partnerPayment.findMany({
    where: {
      date: filters.dateRange ? dateWhere(filters.dateRange) : undefined,
      partnerId:
        filters.partnerIds && filters.partnerIds.length > 0
          ? { in: filters.partnerIds }
          : undefined,
    },
    include: {
      partner: { select: { id: true, name: true } },
      contract: { select: { projectName: true, status: true } },
      partnerPayslip: { select: { number: true } },
    },
    orderBy: { date: "desc" },
  });

  return payments.map((p) => ({
    id: p.id,
    date: p.date,
    partnerId: p.partner.id,
    partnerName: p.partner.name,
    projectName: p.contract?.projectName ?? null,
    contractStatus: (p.contract?.status as ContractStatus | undefined) ?? null,
    revenueAmount: p.revenueAmount != null ? Number(p.revenueAmount) : null,
    workCostAmount: p.workCostAmount != null ? Number(p.workCostAmount) : null,
    projectExpensesAmount:
      p.projectExpensesAmount != null ? Number(p.projectExpensesAmount) : null,
    profitAmount: p.profitAmount != null ? Number(p.profitAmount) : null,
    sharePercentageUsed:
      p.sharePercentageUsed != null ? Number(p.sharePercentageUsed) : null,
    amount: Number(p.amount),
    issued: p.partnerPayslipId != null,
    payslipNumber: p.partnerPayslip?.number ?? null,
  }));
}

export type PartnerLedgerTotals = {
  totalRevenue: number;
  totalWorkCost: number;
  totalExpenses: number;
  totalShare: number;
  totalPaid: number;
  totalPending: number;
};

export function summarizePartnerLedger(
  rows: PartnerLedgerRow[],
): PartnerLedgerTotals {
  return rows.reduce(
    (acc, r) => ({
      totalRevenue: acc.totalRevenue + (r.revenueAmount ?? 0),
      totalWorkCost: acc.totalWorkCost + (r.workCostAmount ?? 0),
      totalExpenses: acc.totalExpenses + (r.projectExpensesAmount ?? 0),
      totalShare: acc.totalShare + r.amount,
      totalPaid: acc.totalPaid + (r.issued ? r.amount : 0),
      totalPending: acc.totalPending + (r.issued ? 0 : r.amount),
    }),
    {
      totalRevenue: 0,
      totalWorkCost: 0,
      totalExpenses: 0,
      totalShare: 0,
      totalPaid: 0,
      totalPending: 0,
    },
  );
}
