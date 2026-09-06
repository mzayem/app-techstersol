import { PayslipDialog } from "@/components/team/payslip-dialog";
import { PayslipRowActions } from "@/components/team/payslip-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPayslipNumber } from "@/lib/team/constants";
import { listPayslips } from "@/actions/team/payslip-queries";
import { listTeamMemberOptions } from "@/actions/team/queries";
import { listOutsourcedContractOptions } from "@/actions/contracts/queries";
import { listWorkDiaryEntries } from "@/actions/team/work-diary-queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function PayslipsPage() {
  const { permission } = await requirePagePermission("payslips");
  const [payslips, teamMembers, contracts, diaryEntries] = await Promise.all([
    listPayslips({}),
    listTeamMemberOptions(),
    listOutsourcedContractOptions(),
    listWorkDiaryEntries({ period: "year" }),
  ]);

  const workDiaryOptions = diaryEntries.map((e) => ({
    id: e.id,
    teamMemberId: e.teamMemberId,
    weekStart: e.weekStart,
    weekEnd: e.weekEnd,
    hours: Number(e.hours),
    amount: e.amount ? Number(e.amount) : null,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Payslips</h1>
        {permission.canCreate && (
          <PayslipDialog
            teamMembers={teamMembers}
            contracts={contracts}
            workDiaryEntries={workDiaryOptions}
          />
        )}
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payslip</TableHead>
              <TableHead>Team member</TableHead>
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
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No payslips issued yet.
                </TableCell>
              </TableRow>
            )}
            {payslips.map((payslip) => (
              <TableRow key={payslip.id}>
                <TableCell className="font-medium">
                  {formatPayslipNumber(payslip.number)}
                </TableCell>
                <TableCell>{payslip.teamMember.name}</TableCell>
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
                    <PayslipRowActions id={payslip.id} number={payslip.number} />
                  </div>
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

function formatPkr(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}
