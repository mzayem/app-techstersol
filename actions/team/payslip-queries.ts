import { prisma } from "@/lib/prisma";
import { dateWhere, type DateRange } from "@/lib/finance/date-range";

export type SortOption = "number-desc" | "number-asc" | "issue-desc" | "issue-asc";

export type ListFilters = {
  search?: string;
  sort?: SortOption;
  /** Filters by `issueDate` — omit for no date filtering. */
  dateRange?: DateRange;
};

function orderBy(sort: SortOption | undefined) {
  switch (sort) {
    case "number-asc":
      return { number: "asc" as const };
    case "issue-asc":
      return { issueDate: "asc" as const };
    case "issue-desc":
      return { issueDate: "desc" as const };
    case "number-desc":
    default:
      return { number: "desc" as const };
  }
}

export async function listPayslips(filters: ListFilters) {
  return prisma.payslip.findMany({
    where: {
      issueDate: filters.dateRange ? dateWhere(filters.dateRange) : undefined,
      teamMember: filters.search
        ? { name: { contains: filters.search, mode: "insensitive" } }
        : undefined,
    },
    include: {
      teamMember: { select: { id: true, name: true } },
      contract: { select: { id: true, projectName: true } },
    },
    orderBy: orderBy(filters.sort),
  });
}

export async function getPayslipForPdf(id: string) {
  return prisma.payslip.findUnique({
    where: { id },
    include: { teamMember: true, contract: { select: { projectName: true } } },
  });
}

/** Public-safe fields only, for the QR verification page. */
export async function getPayslipForVerification(id: string) {
  const payslip = await prisma.payslip.findUnique({
    where: { id },
    select: {
      number: true,
      periodStart: true,
      periodEnd: true,
      issueDate: true,
      amount: true,
      teamMember: { select: { name: true } },
      contract: { select: { projectName: true } },
    },
  });
  if (!payslip) return null;
  return {
    number: payslip.number,
    periodStart: payslip.periodStart,
    periodEnd: payslip.periodEnd,
    issueDate: payslip.issueDate,
    amount: Number(payslip.amount),
    teamMemberName: payslip.teamMember.name,
    projectName: payslip.contract?.projectName ?? null,
  };
}
