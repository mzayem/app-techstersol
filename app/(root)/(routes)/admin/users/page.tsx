import { UserDialog, UserRowActions } from "@/components/rbac/user-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { listAppUsers } from "@/actions/rbac/user-queries";
import { listRoleOptions } from "@/actions/rbac/role-queries";
import { listTeamMemberOptions } from "@/actions/team/queries";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePagePermission("users");

  const [users, roles, teamMembers] = await Promise.all([
    listAppUsers(),
    listRoleOptions(),
    listTeamMemberOptions(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Users</h1>
          <p className="text-sm text-muted-foreground">
            Sign-up is disabled — this is the only way to create a new
            account, dashboard handler or team login.
          </p>
        </div>
        <UserDialog
          roles={roles}
          teamMembers={teamMembers.map((m) => ({ id: m.id, name: m.name }))}
        />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Role / Team member</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  {user.kind === "DASHBOARD_HANDLER" ? "Dashboard handler" : "Team login"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.role?.name ?? user.teamMember?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <UserRowActions id={user.id} name={user.name} />
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
