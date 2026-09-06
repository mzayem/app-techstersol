import {
  TeamMemberDialog,
  TeamMemberRowActions,
} from "@/components/team/team-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentCurrency } from "@/lib/clients/constants";
import {
  TEAM_MEMBER_TYPE_LABELS,
  type TeamMemberType,
} from "@/lib/team/constants";
import { listTeamMembers } from "@/actions/team/queries";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const members = await listTeamMembers({});

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Team members</h1>
        <TeamMemberDialog />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No team members yet.
                </TableCell>
              </TableRow>
            )}
            {members.map((member) => {
              const type = member.type as TeamMemberType;
              const entry = {
                id: member.id,
                name: member.name,
                phone: member.phone,
                email: member.email,
                country: member.country,
                currency: member.currency as PaymentCurrency | null,
                address: member.address,
                type,
                hourlyRate: member.hourlyRate ? Number(member.hourlyRate) : null,
              };
              return (
                <TeamMemberRowActions key={member.id} entry={entry}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {TEAM_MEMBER_TYPE_LABELS[type]}
                    {type === "HOURLY" && entry.hourlyRate
                      ? ` · ${entry.hourlyRate}/hr`
                      : ""}
                  </TableCell>
                  <TableCell>{member.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email ?? "—"}
                  </TableCell>
                  <TableCell>{member.country ?? "—"}</TableCell>
                  <TableCell>{member.currency ?? "—"}</TableCell>
                </TeamMemberRowActions>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
