import {
  WorkDiaryDialog,
  WorkDiaryRowActions,
} from "@/components/team/work-diary-dialog";
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
import { formatWeekRange } from "@/lib/team/work-diary";
import { getRatesToPkr } from "@/lib/fx/rates";
import { requireTeamUser } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/prisma";
import { listWorkDiaryEntries } from "@/actions/team/work-diary-queries";

export const dynamic = "force-dynamic";

export default async function PortalWorkDiaryPage() {
  const appUser = await requireTeamUser();
  const teamMemberId = appUser.teamMember!.id;

  const [member, entries, ratesToPkr] = await Promise.all([
    prisma.teamMember.findUniqueOrThrow({
      where: { id: teamMemberId },
      select: { id: true, name: true, type: true, hourlyRate: true, currency: true },
    }),
    listWorkDiaryEntries({ teamMemberId, period: "all" }),
    getRatesToPkr(),
  ]);

  const teamMembers = [
    {
      id: member.id,
      name: member.name,
      type: member.type as TeamMemberType,
      hourlyRate: member.hourlyRate ? Number(member.hourlyRate) : null,
      currency: member.currency as PaymentCurrency,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Work Diary</h1>
          <p className="text-sm text-muted-foreground">
            Log your hours for the week — Monday through Sunday.
          </p>
        </div>
        <WorkDiaryDialog teamMembers={teamMembers} ratesToPkr={ratesToPkr} />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No entries yet.
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
                  <TableCell className="font-medium">
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
