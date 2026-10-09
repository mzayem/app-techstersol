import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { contractRevenueBasis, isOpenEnded } from "@/lib/contracts/constants";
import { formatInvoiceNumber } from "@/lib/invoices/constants";
import { computePartnerSplit } from "@/lib/partners/calc";
import { getRatesToPkr } from "@/lib/fx/rates";

type InvoiceForEarning = {
  id: string;
  number: number;
  currency: string;
  discount: unknown;
  items: {
    id: string;
    amount: unknown;
    contractId: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }[];
  client: { name: string };
};

export type InvoiceEarningPlan = Awaited<ReturnType<typeof planInvoiceEarning>>;

const contractSelect = {
  id: true,
  projectName: true,
  paymentType: true,
  amount: true,
  currency: true,
  teamMemberId: true,
  teamPayAmount: true,
  milestones: { select: { amount: true } },
  partnerId: true,
  partnerSharePercent: true,
  partner: { select: { name: true, sharePercentage: true } },
} as const;

type PartnerBooking = {
  contractId: string;
  partnerId: string;
  partnerName: string;
  projectName: string;
  revenue: number;
  workCost: number;
  projectExpenses: number;
  profit: number;
  sharePercent: number;
  partnerShareAmount: number;
};

/** Works out everything an invoice's Earning row books: net earning, team
 * pay, project expenses and partner shares. Shared by markInvoicePaid
 * (booking at payment time) and addInvoiceEarning (booking later, once the
 * money actually reaches the PKR account) so both paths produce identical
 * figures. Runs outside the transaction since it may fetch FX rates.
 *
 * Two kinds of contract are booked differently:
 * - fixed-price (PROJECT/MILESTONE): booked once, when this invoice is the
 *   one that fully paid the contract off (`completedContractIds`);
 * - open-ended (HOURLY/RECURRING): there's no "paid off", so every paid
 *   invoice books the team pay, project expenses and partner share for
 *   the periods/hours it bills. */
export async function planInvoiceEarning({
  invoice,
  completedContractIds,
  pkrAmount,
  feesPkr = 0,
}: {
  invoice: InvoiceForEarning;
  /** Fixed-price contracts this invoice's payment fully paid off — their
   * team pay, project expenses and partner shares are booked here, once. */
  completedContractIds: string[];
  /** Actual PKR received — the gross ledger credit. Already net of fees. */
  pkrAmount: number;
  /** Fees/taxes (in PKR) deducted from this payment before it arrived. */
  feesPkr?: number;
}) {
  const currency = invoice.currency as PaymentCurrency;
  const grossTotal = invoice.items.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const balanceDue = grossTotal - Number(invoice.discount);

  const billedContractIds = [
    ...new Set(
      invoice.items
        .map((item) => item.contractId)
        .filter((id): id is string => !!id),
    ),
  ];
  const contracts = await prisma.contract.findMany({
    where: { id: { in: [...completedContractIds, ...billedContractIds] } },
    select: contractSelect,
  });
  const completedContracts = contracts.filter(
    (c) => completedContractIds.includes(c.id) && !isOpenEnded(c.paymentType),
  );
  const openEndedContracts = contracts.filter(
    (c) => billedContractIds.includes(c.id) && isOpenEnded(c.paymentType),
  );

  let teamPay = 0;
  let projectExpensesTotal = 0;
  const shareInputs: {
    contract: (typeof contracts)[number];
    revenue: number;
    workCost: number;
    projectExpenses: number;
  }[] = [];

  // --- Fixed-price contracts completed by this payment ---------------------

  // A contract's outsourced pay is credited to the team member once, when
  // that contract is fully paid off — not per invoice, since a contract can
  // span several partial invoices before it completes.
  const fixedExpenses = completedContracts.length
    ? await prisma.projectExpense.groupBy({
        by: ["contractId"],
        where: { contractId: { in: completedContracts.map((c) => c.id) } },
        _sum: { pkrAmount: true },
      })
    : [];
  const fixedExpenseOf = new Map(
    fixedExpenses.map((e) => [e.contractId, Number(e._sum.pkrAmount ?? 0)]),
  );

  // workCost is always PKR (same convention as team pay), and project
  // expenses are summed from their stored PKR equivalent (they're entered
  // in the contract's own currency),
  // so a non-PKR contract's face-value revenue must be converted to PKR
  // before combining them — otherwise profit is computed from mismatched
  // units (e.g. $100 revenue minus a PKR 8,327 work cost).
  const ratesToPkr = completedContracts.some(
    (c) => c.partnerId && c.currency !== "PKR",
  )
    ? await getRatesToPkr()
    : null;

  // Fees deducted from a partnered contract's payments (this one and any
  // earlier ones) come off its revenue, so the partner's profit share is
  // worked out on what was actually received.
  const feesByContract = await feesByFixedContract(
    invoice,
    feesPkr,
    completedContracts.filter((c) => c.partnerId).map((c) => c.id),
  );

  for (const c of completedContracts) {
    const workCost = Number(c.teamPayAmount ?? 0);
    // Project-level expenses reduce net earning on every completing
    // contract, partnered or not — booked to the ledger already at entry
    // time (see ProjectExpense), this is just the aggregate for the Earning
    // row.
    const projectExpenses = fixedExpenseOf.get(c.id) ?? 0;
    if (c.teamMemberId) teamPay += workCost;
    projectExpensesTotal += projectExpenses;

    const rawRevenue = contractRevenueBasis(c);
    const revenue =
      (c.currency === "PKR"
        ? rawRevenue
        : rawRevenue * (ratesToPkr?.[c.currency as PaymentCurrency] ?? 1)) -
      (feesByContract.get(c.id) ?? 0);
    shareInputs.push({ contract: c, revenue, workCost, projectExpenses });
  }

  // --- Open-ended contracts billed on this invoice -------------------------

  for (const c of openEndedContracts) {
    const items = invoice.items.filter((item) => item.contractId === c.id);
    const billed = items.reduce((sum, item) => sum + Number(item.amount), 0);
    // This contract's slice of what actually landed in PKR — no FX guess
    // needed, the real received amount is known.
    const revenue = grossTotal > 0 ? (pkrAmount * billed) / grossTotal : 0;

    // RECURRING team pay is per billing period; HOURLY is per logged hour.
    let workUnits = items.length;
    if (c.paymentType === "HOURLY") {
      const hours = await prisma.contractHourLog.aggregate({
        where: { invoiceItemId: { in: items.map((item) => item.id) } },
        _sum: { hours: true },
      });
      workUnits = Number(hours._sum.hours ?? 0);
    }
    const workCost = Number(c.teamPayAmount ?? 0) * workUnits;

    // Project expenses dated inside the periods this invoice bills.
    const starts = items.flatMap((i) => (i.periodStart ? [i.periodStart] : []));
    const ends = items.flatMap((i) => (i.periodEnd ? [i.periodEnd] : []));
    let projectExpenses = 0;
    if (starts.length && ends.length) {
      const sum = await prisma.projectExpense.aggregate({
        where: {
          contractId: c.id,
          date: {
            gte: new Date(Math.min(...starts.map((d) => d.getTime()))),
            lte: new Date(Math.max(...ends.map((d) => d.getTime()))),
          },
        },
        _sum: { pkrAmount: true },
      });
      projectExpenses = Number(sum._sum.pkrAmount ?? 0);
    }

    if (c.teamMemberId) teamPay += workCost;
    projectExpensesTotal += projectExpenses;
    shareInputs.push({ contract: c, revenue, workCost, projectExpenses });
  }

  // --- Partner shares ------------------------------------------------------

  // A partner's share is booked once per completed fixed-price contract, or
  // once per paid invoice for an open-ended one. A share already booked
  // (e.g. this invoice's earning was deleted by hand and is now being
  // re-added) is reused rather than booked twice. See lib/partners/calc.ts
  // for the formula.
  const partnered = shareInputs.filter(
    (s) => s.contract.partnerId && s.contract.partner,
  );
  const existingShares = partnered.length
    ? await prisma.partnerPayment.findMany({
        where: {
          contractId: { in: partnered.map((s) => s.contract.id) },
          source: "AUTO_COMPLETION",
        },
        select: { contractId: true, amount: true, invoiceId: true },
      })
    : [];

  let alreadyBookedShare = 0;
  const partnerBookings: PartnerBooking[] = [];
  for (const { contract: c, revenue, workCost, projectExpenses } of partnered) {
    const existing = existingShares.filter(
      (p) =>
        p.contractId === c.id &&
        (!isOpenEnded(c.paymentType) || p.invoiceId === invoice.id),
    );
    if (existing.length > 0) {
      alreadyBookedShare += existing.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      continue;
    }
    const sharePercent = Number(
      c.partnerSharePercent ?? c.partner!.sharePercentage,
    );
    const split = computePartnerSplit({
      revenue,
      workCost,
      projectExpenses,
      sharePercent,
    });
    if (split.partnerShareAmount > 0) {
      partnerBookings.push({
        contractId: c.id,
        partnerId: c.partnerId!,
        partnerName: c.partner!.name,
        projectName: c.projectName,
        ...split,
      });
    }
  }

  const partnerShareTotal =
    alreadyBookedShare +
    partnerBookings.reduce((sum, b) => sum + b.partnerShareAmount, 0);

  // Earning.amount (the P&L/tax-relevant figure shown on the Earning page)
  // is net of the partner share and project expenses — the gross figure
  // the client actually paid stays on Invoice.pkrAmount instead, so it's
  // never lost. This is deliberately separate from the ledger's own EARNING
  // credit, which stays GROSS: the full pkrAmount really did land in the
  // company's bank account, and the partner's cut is a real cash-OUT event
  // that hasn't happened yet (it's deferred to whenever their payslip is
  // actually issued) — crediting only the net figure would make the
  // ledger's running balance understate real cash on hand until then.
  const netEarningAmount = pkrAmount - partnerShareTotal - projectExpensesTotal;

  return {
    invoiceId: invoice.id,
    feesPkr,
    earningName: `${invoice.client.name} — Invoice ${formatInvoiceNumber(invoice.number)}`,
    pkrAmount,
    netEarningAmount,
    teamPay,
    partnerShareTotal,
    projectExpensesTotal,
    referenceAmount: currency === "PKR" ? null : balanceDue,
    referenceCurrency: currency === "PKR" ? null : currency,
    partnerBookings,
  };
}

/** Writes a planned Earning (with its ledger entries) and any new partner
 * shares inside the caller's transaction. */
export async function writeInvoiceEarning(
  tx: Prisma.TransactionClient,
  plan: InvoiceEarningPlan,
  { date, createdByUserId }: { date: Date; createdByUserId: string },
) {
  const { earningName, pkrAmount, teamPay } = plan;

  await tx.earning.create({
    data: {
      date,
      name: earningName,
      amount: plan.netEarningAmount,
      teamPay,
      partnerShare: plan.partnerShareTotal,
      projectExpenses: plan.projectExpensesTotal,
      fees: plan.feesPkr,
      referenceAmount: plan.referenceAmount,
      referenceCurrency: plan.referenceCurrency,
      invoiceId: plan.invoiceId,
      createdByUserId,
      ledgerEntries: {
        create: [
          {
            type: "EARNING",
            name: earningName,
            date,
            credit: pkrAmount,
          },
          ...(teamPay > 0
            ? [
                {
                  type: "TEAM_PAYMENT" as const,
                  name: `Team pay — ${earningName}`,
                  date,
                  debit: teamPay,
                },
              ]
            : []),
        ],
      },
    },
  });

  // Each partner's share gets its own directly-attributable PartnerPayment
  // so "who is owed how much for which contract" is never lost — but
  // unlike teamPay (expensed immediately above), its ledger debit is
  // deferred until the share is actually paid out via a partner payslip
  // (see createPartnerPayslip). Booking it here too, alongside an
  // already-net Earning credit, would double-subtract it from the
  // balance — it isn't real cash out yet, just an accrued liability.
  for (const booking of plan.partnerBookings) {
    await tx.partnerPayment.create({
      data: {
        date,
        name: `${booking.partnerName} — ${booking.projectName}`,
        partnerId: booking.partnerId,
        contractId: booking.contractId,
        invoiceId: plan.invoiceId,
        amount: booking.partnerShareAmount,
        source: "AUTO_COMPLETION",
        revenueAmount: booking.revenue,
        workCostAmount: booking.workCost,
        projectExpensesAmount: booking.projectExpenses,
        profitAmount: booking.profit,
        sharePercentageUsed: booking.sharePercent,
        createdByUserId,
      },
    });
  }
}

/** PKR fees attributable to each of these fixed-price contracts across all
 * their paid invoices — this one (`feesPkr`, not saved yet) plus earlier
 * ones. An invoice's fees are split across its contracts by billed amount.
 * Earlier fees not yet converted to PKR (payment not added to earning) are
 * converted at today's rate. */
async function feesByFixedContract(
  invoice: InvoiceForEarning,
  feesPkr: number,
  contractIds: string[],
) {
  const fees = new Map<string, number>();
  if (contractIds.length === 0) return fees;
  const add = (id: string, amount: number) =>
    fees.set(id, (fees.get(id) ?? 0) + amount);

  const thisGross = invoice.items.reduce((s, i) => s + Number(i.amount), 0);
  if (feesPkr > 0 && thisGross > 0) {
    for (const item of invoice.items) {
      if (item.contractId && contractIds.includes(item.contractId)) {
        add(item.contractId, (feesPkr * Number(item.amount)) / thisGross);
      }
    }
  }

  const earlier = await prisma.invoiceItem.findMany({
    where: {
      contractId: { in: contractIds },
      invoice: {
        status: "PAID",
        id: { not: invoice.id },
        feesAmount: { gt: 0 },
      },
    },
    select: {
      contractId: true,
      amount: true,
      invoice: {
        select: {
          currency: true,
          feesAmount: true,
          feesPkr: true,
          items: { select: { amount: true } },
        },
      },
    },
  });
  const rates = earlier.some(
    (i) => i.invoice.feesPkr == null && i.invoice.currency !== "PKR",
  )
    ? await getRatesToPkr()
    : null;
  for (const item of earlier) {
    const gross = item.invoice.items.reduce((s, i) => s + Number(i.amount), 0);
    if (gross <= 0) continue;
    const invoiceFeesPkr =
      item.invoice.feesPkr != null
        ? Number(item.invoice.feesPkr)
        : Number(item.invoice.feesAmount) *
          (item.invoice.currency === "PKR"
            ? 1
            : (rates?.[item.invoice.currency as PaymentCurrency] ?? 1));
    add(item.contractId!, (invoiceFeesPkr * Number(item.amount)) / gross);
  }
  return fees;
}
