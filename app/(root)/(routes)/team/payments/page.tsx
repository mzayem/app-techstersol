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
import { listTeamPayments } from "@/actions/team/queries";

export const dynamic = "force-dynamic";

export default async function TeamPaymentsPage() {
  const payments = await listTeamPayments();
  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Team Payments</h1>
          <p className="text-sm text-muted-foreground">
            Every payment made out to the team, generated automatically from
            payslips.
          </p>
        </div>
        <div className="rounded-md bg-card px-4 py-2 text-sm ring-1 ring-foreground/10">
          <span className="text-muted-foreground">Total paid: </span>
          <span className="font-medium tabular-nums">{formatPkr(total)}</span>
        </div>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Team member</TableHead>
              <TableHead>Payslip</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No team payments recorded yet.
                </TableCell>
              </TableRow>
            )}
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-muted-foreground">
                  {formatDate(payment.date)}
                </TableCell>
                <TableCell className="font-medium">
                  {payment.payslip?.teamMember.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {payment.payslip
                    ? formatPayslipNumber(payment.payslip.number)
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPkr(Number(payment.amount))}
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
