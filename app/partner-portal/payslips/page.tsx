import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { formatPkr } from "@/lib/finance/constants";
import { requirePartnerUser } from "@/lib/rbac/permissions";
import { listPartnerPayslips } from "@/actions/partner-portal/queries";

export const dynamic = "force-dynamic";

/** Same "PS-00001" shape as lib/team/constants.ts::formatPayslipNumber,
 * kept local here rather than importing from the dashboard-side
 * lib/partners/* module (owned by a concurrently in-flight change) — pure
 * display formatting, nothing to coordinate on. */
function formatPartnerPayslipNumber(number: number) {
  return `PS-${String(number).padStart(5, "0")}`;
}

export default async function PartnerPayslipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requirePartnerUser();
  const partner = appUser.partner!;
  const params = await searchParams;
  const payslips = await listPartnerPayslips(partner.id);
  const paginated = paginate(
    payslips,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Payslips</h1>
        <p className="text-sm text-muted-foreground">
          Every payslip issued to you.
        </p>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payslip</TableHead>
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
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No payslips issued yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((payslip) => (
              <TableRow key={payslip.id}>
                <TableCell className="font-medium">
                  {formatPartnerPayslipNumber(payslip.number)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {payslip.contract?.projectName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(payslip.periodStart)} –{" "}
                  {formatDate(payslip.periodEnd)}
                </TableCell>
                <TableCell>{formatDate(payslip.issueDate)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPkr(Number(payslip.amount))}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Download payslip PDF"
                    render={
                      <a
                        href={`/api/partner-payslips/${payslip.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <DownloadIcon />
                  </Button>
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
