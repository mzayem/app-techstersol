import { prisma } from "@/lib/prisma";

export async function listPartnerInvestments() {
  return prisma.partnerInvestment.findMany({
    include: {
      partner: { select: { id: true, name: true, email: true } },
      partnerPayment: {
        select: { contract: { select: { projectName: true } } },
      },
    },
    orderBy: { number: "desc" },
  });
}

export async function listPartnerInvestmentSpends() {
  return prisma.partnerInvestmentSpend.findMany({
    include: { partner: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });
}

export type PartnerInvestmentBalance = {
  partnerId: string;
  invested: number;
  spent: number;
  available: number;
};

/** One partner's investment wallet: everything they've contributed
 * (PartnerInvestment) minus everything logged as spent
 * (PartnerInvestmentSpend) — never touches the money ledger, see the
 * schema comment on PartnerInvestment. */
export async function getPartnerInvestmentBalance(
  partnerId: string,
): Promise<PartnerInvestmentBalance> {
  const [invested, spent] = await Promise.all([
    prisma.partnerInvestment.aggregate({
      where: { partnerId },
      _sum: { amount: true },
    }),
    prisma.partnerInvestmentSpend.aggregate({
      where: { partnerId },
      _sum: { amount: true },
    }),
  ]);
  const investedAmount = Number(invested._sum.amount ?? 0);
  const spentAmount = Number(spent._sum.amount ?? 0);
  return {
    partnerId,
    invested: investedAmount,
    spent: spentAmount,
    available: investedAmount - spentAmount,
  };
}

/** Every partner's balance in one query, for the dashboard-wide investments
 * page (avoids an N+1 across getPartnerInvestmentBalance per row). */
export async function listPartnerInvestmentBalances(): Promise<
  Map<string, PartnerInvestmentBalance>
> {
  const [invested, spent] = await Promise.all([
    prisma.partnerInvestment.groupBy({
      by: ["partnerId"],
      _sum: { amount: true },
    }),
    prisma.partnerInvestmentSpend.groupBy({
      by: ["partnerId"],
      _sum: { amount: true },
    }),
  ]);

  const balances = new Map<string, PartnerInvestmentBalance>();
  for (const row of invested) {
    const investedAmount = Number(row._sum.amount ?? 0);
    balances.set(row.partnerId, {
      partnerId: row.partnerId,
      invested: investedAmount,
      spent: 0,
      available: investedAmount,
    });
  }
  for (const row of spent) {
    const spentAmount = Number(row._sum.amount ?? 0);
    const existing = balances.get(row.partnerId);
    if (existing) {
      existing.spent = spentAmount;
      existing.available = existing.invested - spentAmount;
    } else {
      balances.set(row.partnerId, {
        partnerId: row.partnerId,
        invested: 0,
        spent: spentAmount,
        available: -spentAmount,
      });
    }
  }
  return balances;
}

export async function getPartnerInvestmentForPdf(id: string) {
  return prisma.partnerInvestment.findUnique({
    where: { id },
    include: {
      partner: true,
      partnerPayment: {
        select: { contract: { select: { projectName: true } } },
      },
    },
  });
}

/** Shared by the PDF route handler — maps a getPartnerInvestmentForPdf
 * result into renderPartnerInvestmentPdf's expected shape. */
export function toPartnerInvestmentPdfData(
  investment: NonNullable<
    Awaited<ReturnType<typeof getPartnerInvestmentForPdf>>
  >,
) {
  return {
    id: investment.id,
    number: investment.number,
    date: investment.date,
    amount: Number(investment.amount),
    method: investment.method,
    transactionId: investment.transactionId,
    note: investment.note,
    projectName: investment.partnerPayment?.contract?.projectName ?? null,
    partner: {
      name: investment.partner.name,
      phone: investment.partner.phone,
      email: investment.partner.email,
    },
  };
}
