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
import { formatPkr } from "@/lib/finance/constants";
import { formatPayslipNumber } from "@/lib/team/constants";
import { requireTeamUser } from "@/lib/rbac/permissions";
import { listMyPayslips } from "@/actions/portal/queries";

export const dynamic = "force-dynamic";

export default async function PortalPayslipsPage() {
  const appUser = await requireTeamUser();
  const payslips = await listMyPayslips(appUser.teamMember!.id);

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
            {payslips.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No payslips issued yet.
                </TableCell>
              </TableRow>
            )}
            {payslips.map((payslip) => (
              <TableRow key={payslip.id}>
                <TableCell className="font-medium">
                  {formatPayslipNumber(payslip.number)}
                </TableCell>
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Download payslip PDF"
                    render={
                      <a
                        href={`/api/payslips/${payslip.id}/pdf`}
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
