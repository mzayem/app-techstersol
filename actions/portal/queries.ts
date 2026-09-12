import { prisma } from "@/lib/prisma";
import { CONTRACT_STATUSES_EXCLUDED_FROM_PENDING } from "@/lib/contracts/constants";

export type PortalOverview = {
  completedProjects: number;
  pendingProjects: number;
  /** Owed but not yet paid: teamPayAmount on their still-open outsourced
   * contracts, plus every logged work diary week (there's no "paid" flag
   * on a diary entry yet — see actions/overview/queries.ts's
   * getTeamPendingPayments for the same reasoning, scoped here to one
   * member). A contract that's PAUSED or CANCELLED is excluded, same as
   * there — nothing is expected to be paid on it while it stays that way. */
  pendingPaymentPkr: number;
  /** Money that actually left the company for them this year — sourced
   * only from TeamPayment (via their Payslips), since an Earning's
   * teamPay is a lump figure that can span multiple team members and
   * isn't traceable back to one person. */
  paidThisYearPkr: number;
};

export async function getPortalOverview(teamMemberId: string): Promise<PortalOverview> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);

  const [contracts, openContracts, diarySum, paidThisYear] = await Promise.all([
    prisma.contract.findMany({
      where: { teamMemberId },
      select: { status: true },
    }),
    prisma.contract.findMany({
      where: {
        teamMemberId,
        status: {
          notIn: ["COMPLETED", ...CONTRACT_STATUSES_EXCLUDED_FROM_PENDING],
        },
      },
      select: { teamPayAmount: true },
    }),
    prisma.workDiaryEntry.aggregate({
      where: { teamMemberId },
      _sum: { amount: true },
    }),
    prisma.teamPayment.aggregate({
      where: { payslip: { teamMemberId }, date: { gte: yearStart, lte: yearEnd } },
      _sum: { amount: true },
    }),
  ]);

  const completedProjects = contracts.filter((c) => c.status === "COMPLETED").length;
  const pendingProjects = contracts.length - completedProjects;
  const openTeamPay = openContracts.reduce(
    (sum, c) => sum + Number(c.teamPayAmount ?? 0),
    0,
  );

  return {
    completedProjects,
    pendingProjects,
    pendingPaymentPkr: openTeamPay + Number(diarySum._sum.amount ?? 0),
    paidThisYearPkr: Number(paidThisYear._sum.amount ?? 0),
  };
}

export type MyProject = {
  id: string;
  projectName: string;
  deadline: Date;
  status: string;
};

/** Project name and deadline only — the contract amount and client
 * details are confidential and never exposed here. */
export async function listMyProjects(teamMemberId: string): Promise<MyProject[]> {
  return prisma.contract.findMany({
    where: { teamMemberId },
    select: { id: true, projectName: true, deadline: true, status: true },
    orderBy: { deadline: "asc" },
  });
}

export async function listMyPayslips(teamMemberId: string) {
  return prisma.payslip.findMany({
    where: { teamMemberId },
    include: { contract: { select: { projectName: true } } },
    orderBy: { issueDate: "desc" },
  });
}
