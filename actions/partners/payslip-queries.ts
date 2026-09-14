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

export async function listPartnerPayslips(filters: ListFilters = {}) {
  return prisma.partnerPayslip.findMany({
    where: {
      issueDate: filters.dateRange ? dateWhere(filters.dateRange) : undefined,
      partner: filters.search
        ? { name: { contains: filters.search, mode: "insensitive" } }
        : undefined,
    },
    include: {
      partner: { select: { id: true, name: true, email: true } },
      contract: { select: { id: true, projectName: true } },
    },
    orderBy: orderBy(filters.sort),
  });
}

export async function getPartnerPayslipForPdf(id: string) {
  return prisma.partnerPayslip.findUnique({
    where: { id },
    include: { partner: true, contract: { select: { projectName: true } } },
  });
}

/** Maps a `getPartnerPayslipForPdf` result into the shape `renderPartnerPayslipPdf`
 * expects — shared by the PDF route handler and the payslip-email notifier
 * so both build the exact same document. */
export function toPartnerPayslipPdfData(
  payslip: NonNullable<Awaited<ReturnType<typeof getPartnerPayslipForPdf>>>,
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
    partner: {
      name: payslip.partner.name,
      phone: payslip.partner.phone,
      email: payslip.partner.email,
    },
  };
}

/** Public-safe fields only, for the QR verification page. */
export async function getPartnerPayslipForVerification(id: string) {
  const payslip = await prisma.partnerPayslip.findUnique({
    where: { id },
    select: {
      number: true,
      periodStart: true,
      periodEnd: true,
      issueDate: true,
      amount: true,
      partner: { select: { name: true } },
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
    partnerName: payslip.partner.name,
    projectName: payslip.contract?.projectName ?? null,
  };
}
