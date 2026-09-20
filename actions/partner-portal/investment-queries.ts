import { prisma } from "@/lib/prisma";

export async function listPartnerOwnInvestments(partnerId: string) {
  return prisma.partnerInvestment.findMany({
    where: { partnerId },
    include: {
      partnerPayment: {
        select: { contract: { select: { projectName: true } } },
      },
    },
    orderBy: { number: "desc" },
  });
}

export async function listPartnerOwnInvestmentSpends(partnerId: string) {
  return prisma.partnerInvestmentSpend.findMany({
    where: { partnerId },
    orderBy: { date: "desc" },
  });
}

export async function getPartnerOwnInvestmentBalance(partnerId: string) {
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
    invested: investedAmount,
    spent: spentAmount,
    available: investedAmount - spentAmount,
  };
}
