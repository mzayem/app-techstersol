import { prisma } from "@/lib/prisma";

export type PartnerEarningsRow = {
  partnerId: string;
  partnerName: string;
  paid: number;
  pending: number;
  total: number;
};

export type PartnerEarningsReport = {
  totalPaid: number;
  totalPending: number;
  byPartner: PartnerEarningsRow[];
};

/** Every PartnerPayment (money booked for a partner's profit share, either
 * accrued automatically at contract completion or booked by hand), split
 * by whether it's been issued as a payslip yet (paid) or not (pending),
 * both overall and per partner. Balance sheet / distributions already
 * reflect this automatically since PARTNER_PAYMENT is a normal
 * LedgerEntry type — this is the attribution view: who it's owed to. */
export async function getPartnerEarningsReport(): Promise<PartnerEarningsReport> {
  const payments = await prisma.partnerPayment.findMany({
    select: {
      amount: true,
      partnerPayslipId: true,
      partner: { select: { id: true, name: true } },
    },
  });

  const byPartner = new Map<string, PartnerEarningsRow>();
  let totalPaid = 0;
  let totalPending = 0;

  for (const payment of payments) {
    const amount = Number(payment.amount);
    const isPaid = payment.partnerPayslipId !== null;

    let row = byPartner.get(payment.partner.id);
    if (!row) {
      row = {
        partnerId: payment.partner.id,
        partnerName: payment.partner.name,
        paid: 0,
        pending: 0,
        total: 0,
      };
      byPartner.set(payment.partner.id, row);
    }

    if (isPaid) {
      row.paid += amount;
      totalPaid += amount;
    } else {
      row.pending += amount;
      totalPending += amount;
    }
    row.total += amount;
  }

  return {
    totalPaid,
    totalPending,
    byPartner: [...byPartner.values()].sort((a, b) => b.total - a.total),
  };
}
