import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { contractRevenueBasis } from "@/lib/contracts/constants";
import { formatInvoiceNumber } from "@/lib/invoices/constants";
import { computePartnerSplit } from "@/lib/partners/calc";
import { getRatesToPkr } from "@/lib/fx/rates";

type InvoiceForEarning = {
  number: number;
  currency: string;
  discount: unknown;
  items: { amount: unknown }[];
  client: { name: string };
};

export type InvoiceEarningPlan = Awaited<ReturnType<typeof planInvoiceEarning>>;

/** Works out everything an invoice's Earning row books: net earning, team
 * pay, project expenses and partner shares for the contracts this invoice
 * completed. Shared by markInvoicePaid (booking at payment time) and
 * addInvoiceEarning (booking later, once the money actually reaches the PKR
 * account) so both paths produce identical figures. Runs outside the
 * transaction since it may fetch FX rates. */
export async function planInvoiceEarning({
  invoice,
  completedContractIds,
  pkrAmount,
}: {
  invoice: InvoiceForEarning;
  /** Contracts this invoice's payment fully paid off — their team pay,
   * project expenses and partner shares are booked here, once. */
  completedContractIds: string[];
  /** Actual PKR received — the gross ledger credit. */
  pkrAmount: number;
}) {
  const currency = invoice.currency as PaymentCurrency;
  const balanceDue =
    invoice.items.reduce((sum, item) => sum + Number(item.amount), 0) -
    Number(invoice.discount);

  const completedContracts =
    completedContractIds.length > 0
      ? await prisma.contract.findMany({
          where: { id: { in: completedContractIds } },
          select: {
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
            projectExpenses: { select: { amount: true } },
          },
        })
      : [];

  // A contract's outsourced pay is credited to the team member once, when
  // that contract is fully paid off — not per invoice, since a contract can
  // span several partial invoices before it completes.
  const teamPay = completedContracts
    .filter((c) => c.teamMemberId)
    .reduce((sum, c) => sum + Number(c.teamPayAmount ?? 0), 0);

  // Project-level expenses reduce net earning on every completing contract,
  // partnered or not — booked to the ledger already at entry time (see
  // ProjectExpense), this is just the aggregate for the Earning row.
  const projectExpensesTotal = completedContracts.reduce(
    (sum, c) =>
      sum + c.projectExpenses.reduce((s, e) => s + Number(e.amount), 0),
    0,
  );

  // A partner's share is booked once, the same moment a partnered contract
  // completes — never pro-rated across partial/milestone payments, matching
  // teamPay's existing behavior. See lib/partners/calc.ts for the formula.
  // workCost/projectExpenses are always PKR (same convention as team pay),
  // so a non-PKR contract's face-value revenue must be converted to PKR
  // before combining them — otherwise profit is computed from mismatched
  // units (e.g. $100 revenue minus a PKR 8,327 work cost).
  const partneredContracts = completedContracts.filter(
    (c) => c.partnerId && c.partner,
  );

  // A share already booked for a contract (e.g. its earning was deleted by
  // hand and is now being re-added) is reused rather than booked twice.
  const existingShares =
    partneredContracts.length > 0
      ? await prisma.partnerPayment.findMany({
          where: {
            contractId: { in: partneredContracts.map((c) => c.id) },
            source: "AUTO_COMPLETION",
          },
          select: { contractId: true, amount: true },
        })
      : [];
  const alreadyBookedShare = existingShares.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const alreadyBookedIds = new Set(existingShares.map((p) => p.contractId));
  const toBook = partneredContracts.filter((c) => !alreadyBookedIds.has(c.id));

  const ratesToPkr = toBook.some((c) => c.currency !== "PKR")
    ? await getRatesToPkr()
    : null;

  const partnerBookings = toBook
    .map((c) => {
      const rawRevenue = contractRevenueBasis(c);
      const revenue =
        c.currency === "PKR"
          ? rawRevenue
          : rawRevenue * (ratesToPkr?.[c.currency as PaymentCurrency] ?? 1);
      const workCost = Number(c.teamPayAmount ?? 0);
      const projectExpenses = c.projectExpenses.reduce(
        (s, e) => s + Number(e.amount),
        0,
      );
      const sharePercent = Number(
        c.partnerSharePercent ?? c.partner!.sharePercentage,
      );
      const split = computePartnerSplit({
        revenue,
        workCost,
        projectExpenses,
        sharePercent,
      });
      return {
        contractId: c.id,
        partnerId: c.partnerId!,
        partnerName: c.partner!.name,
        projectName: c.projectName,
        ...split,
      };
    })
    .filter((b) => b.partnerShareAmount > 0);

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
  {
    invoiceId,
    date,
    createdByUserId,
  }: { invoiceId: string; date: Date; createdByUserId: string },
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
      referenceAmount: plan.referenceAmount,
      referenceCurrency: plan.referenceCurrency,
      invoiceId,
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
