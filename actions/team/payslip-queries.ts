import { prisma } from "@/lib/prisma";
import { dateWhere, type DateRange } from "@/lib/finance/date-range";

export type SortOption =
  "number-desc" | "number-asc" | "issue-desc" | "issue-asc";

export type ListFilters = {
  search?: string;
  sort?: SortOption;
  /** Filters by `issueDate` — omit for no date filtering. */
  dateRange?: DateRange;
};

const NEWEST = { createdAt: "desc" as const };
const OLDEST = { createdAt: "asc" as const };

function orderBy(sort: SortOption | undefined) {
  switch (sort) {
    case "number-asc":
      return { number: "asc" as const };
    case "issue-asc":
      return [{ issueDate: "asc" as const }, OLDEST];
    case "issue-desc":
      return [{ issueDate: "desc" as const }, NEWEST];
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
      teamMember: { select: { id: true, name: true, email: true } },
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

/** Maps a `getPayslipForPdf` result into the shape `renderPayslipPdf`
 * expects — shared by the PDF route handler and the payslip-email
 * notifier so both build the exact same document. */
export function toPayslipPdfData(
  payslip: NonNullable<Awaited<ReturnType<typeof getPayslipForPdf>>>,
) {
  return {
    id: payslip.id,
    number: payslip.number,
    periodStart: payslip.periodStart,
    periodEnd: payslip.periodEnd,
    issueDate: payslip.issueDate,
    amount: Number(payslip.amount),
    note: payslip.note,
    projectName: payslip.contract?.projectName ?? null,
    teamMember: {
      name: payslip.teamMember.name,
      phone: payslip.teamMember.phone,
      email: payslip.teamMember.email,
      country: payslip.teamMember.country,
      address: payslip.teamMember.address,
    },
  };
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
