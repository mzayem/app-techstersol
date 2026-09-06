import {
  WorkDiaryDialog,
  WorkDiaryRowActions,
} from "@/components/team/work-diary-dialog";
import { WorkDiaryFilterBar } from "@/components/team/work-diary-filter-bar";
import { WorkDiaryImportDialog } from "@/components/team/work-diary-import-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatPkr } from "@/lib/finance/constants";
import type { TeamMemberType } from "@/lib/team/constants";
import {
  currentMonthValue,
  formatWeekRange,
  recentMonthOptions,
} from "@/lib/team/work-diary";
import { getRatesToPkr } from "@/lib/fx/rates";
import { listTeamMemberOptions } from "@/actions/team/queries";
import { listWorkDiaryEntries } from "@/actions/team/work-diary-queries";

export const dynamic = "force-dynamic";

export default async function WorkDiaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const teamMemberId = params.teamMemberId ?? "";
  const month = params.month ?? currentMonthValue();

  const [entries, teamMemberOptions, ratesToPkr] = await Promise.all([
    listWorkDiaryEntries({ teamMemberId, month }),
    listTeamMemberOptions(),
    getRatesToPkr(),
  ]);

  const teamMembers = teamMemberOptions.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type as TeamMemberType,
    hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
    currency: m.currency as PaymentCurrency,
  }));

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const totalAmount = entries.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const monthLabel =
    recentMonthOptions(24).find((m) => m.value === month)?.label ?? "this month";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Work Diary</h1>
        <div className="flex items-center gap-2">
          <WorkDiaryImportDialog teamMembers={teamMembers} />
          <WorkDiaryDialog teamMembers={teamMembers} ratesToPkr={ratesToPkr} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <span className="text-xs font-medium text-muted-foreground">
            Amount to pay — {monthLabel}
            {teamMemberId
              ? ` · ${teamMembers.find((m) => m.id === teamMemberId)?.name ?? ""}`
              : ""}
          </span>
          <span className="text-lg font-medium tabular-nums">
            {formatPkr(totalAmount)}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
          <span className="text-xs font-medium text-muted-foreground">
            Total hours logged
          </span>
          <span className="text-lg font-medium tabular-nums">{totalHours}</span>
        </div>
      </div>

      <WorkDiaryFilterBar teamMembers={teamMembers} monthOptions={recentMonthOptions()} />

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team member</TableHead>
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No work diary entries for this filter.
                </TableCell>
              </TableRow>
            )}
            {entries.map((e) => {
              const entry = {
                id: e.id,
                teamMemberId: e.teamMemberId,
                teamMemberName: e.teamMember.name,
                weekStart: e.weekStart,
                hours: Number(e.hours),
                amount: e.amount ? Number(e.amount) : null,
                notes: e.notes,
              };
              return (
                <WorkDiaryRowActions
                  key={e.id}
                  entry={entry}
                  teamMembers={teamMembers}
                  ratesToPkr={ratesToPkr}
                >
                  <TableCell className="font-medium">{e.teamMember.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatWeekRange(e.weekStart, e.weekEnd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(e.hours)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.amount !== null ? formatPkr(entry.amount) : "—"}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {e.notes ?? "—"}
                  </TableCell>
                </WorkDiaryRowActions>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
