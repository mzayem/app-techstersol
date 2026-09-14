import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PartnerReportExportDialog } from "@/components/reports/partner-report-export-dialog";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { formatPkr } from "@/lib/finance/constants";
import { getPartnerEarningsReport } from "@/actions/partners/reports";
import { listPartnerOptions } from "@/actions/partners/queries";

export const dynamic = "force-dynamic";

export default async function PartnerEarningsReportPage() {
  await requirePagePermission("reports-partners");

  const [partnerEarnings, partnerOptions] = await Promise.all([
    getPartnerEarningsReport(),
    listPartnerOptions(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Earnings shared with partners</h1>
          <p className="text-sm text-muted-foreground">
            Who your partner share is owed to, paid vs. pending, and a downloadable breakdown.
          </p>
        </div>
        <PartnerReportExportDialog partners={partnerOptions} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Total paid out</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatPkr(partnerEarnings.totalPaid)}
          </p>
          <p className="text-xs text-muted-foreground">Issued as a payslip</p>
        </div>
        <div className="rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Total pending</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatPkr(partnerEarnings.totalPending)}
          </p>
          <p className="text-xs text-muted-foreground">Accrued, no payslip issued yet</p>
        </div>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partnerEarnings.byPartner.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No partner earnings booked yet.
                </TableCell>
              </TableRow>
            )}
            {partnerEarnings.byPartner.map((row) => (
              <TableRow key={row.partnerId}>
                <TableCell className="font-medium">{row.partnerName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPkr(row.paid)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPkr(row.pending)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatPkr(row.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
