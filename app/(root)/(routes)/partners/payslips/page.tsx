import { PartnerPayslipDialog } from "@/components/partners/partner-payslip-dialog";
import { PartnerPayslipRowActions } from "@/components/partners/partner-payslip-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { formatPartnerPayslipNumber } from "@/lib/partners/constants";
import { listPartnerPayslips } from "@/actions/partners/payslip-queries";
import { listPartnerOptions, listPartnerPendingAccruals } from "@/actions/partners/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function PartnerPayslipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { permission } = await requirePagePermission("partner-payslips");
  const params = await searchParams;
  const [payslips, partners, accruals] = await Promise.all([
    listPartnerPayslips({}),
    listPartnerOptions(),
    listPartnerPendingAccruals(),
  ]);

  const paginated = paginate(payslips, parsePageParam(params.page), parsePageSizeParam(params.pageSize));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Partner payslips</h1>
        {permission.canCreate && (
          <PartnerPayslipDialog partners={partners} accruals={accruals} />
        )}
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payslip</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Issue date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No partner payslips issued yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((payslip) => (
              <TableRow key={payslip.id}>
                <TableCell className="font-medium">
                  {formatPartnerPayslipNumber(payslip.number)}
                </TableCell>
                <TableCell>{payslip.partner.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {payslip.contract?.projectName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(payslip.periodStart)} – {formatDate(payslip.periodEnd)}
                </TableCell>
                <TableCell>{formatDate(payslip.issueDate)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPkr(Number(payslip.amount))}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <PartnerPayslipRowActions
                      id={payslip.id}
                      number={payslip.number}
                      partnerEmail={payslip.partner.email}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          pageSize={paginated.pageSize}
        />
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatPkr(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}
