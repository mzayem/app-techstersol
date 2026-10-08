import { prisma } from "@/lib/prisma";
import { pendingContractTeamPay } from "@/lib/contracts/team-pay";

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

export async function getPortalOverview(
  teamMemberId: string,
): Promise<PortalOverview> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);

  const [contracts, openTeamPay, diarySum, paidThisYear] = await Promise.all([
    prisma.contract.findMany({
      where: { teamMemberId },
      select: { status: true },
    }),
    pendingContractTeamPay({ teamMemberId }),
    prisma.workDiaryEntry.aggregate({
      where: { teamMemberId },
      _sum: { amount: true },
    }),
    prisma.teamPayment.aggregate({
      where: {
        payslip: { teamMemberId },
        date: { gte: yearStart, lte: yearEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const completedProjects = contracts.filter(
    (c) => c.status === "COMPLETED",
  ).length;
  const pendingProjects = contracts.length - completedProjects;

  return {
    completedProjects,
    pendingProjects,
    pendingPaymentPkr: openTeamPay + Number(diarySum._sum.amount ?? 0),
    paidThisYearPkr: Number(paidThisYear._sum.amount ?? 0),
  };
}

export type MyProject = {
  id: string;
  number: number;
  projectName: string;
  date: Date;
  deadline: Date | null;
  status: string;
  paymentType: string;
  billingCycle: string | null;
};

/** Project name and dates only — the contract amount and client details
 * are confidential and never exposed here. "project" (default) excludes
 * recurring services, which have their own page. */
export async function listMyProjects(
  teamMemberId: string,
  kind: "project" | "recurring" = "project",
): Promise<MyProject[]> {
  return prisma.contract.findMany({
    where: {
      teamMemberId,
      paymentType: kind === "recurring" ? "RECURRING" : { not: "RECURRING" },
    },
    select: {
      id: true,
      number: true,
      projectName: true,
      date: true,
      deadline: true,
      status: true,
      paymentType: true,
      billingCycle: true,
    },
    orderBy: { deadline: { sort: "asc", nulls: "last" } },
  });
}

export async function listMyPayslips(teamMemberId: string) {
  return prisma.payslip.findMany({
    where: { teamMemberId },
    include: { contract: { select: { projectName: true } } },
    orderBy: { issueDate: "desc" },
  });
}
