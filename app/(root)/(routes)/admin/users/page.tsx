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
import { listAppUsers, listAvailableClientOptions } from "@/actions/rbac/user-queries";
import { listRoleOptions } from "@/actions/rbac/role-queries";
import { listTeamMemberOptions } from "@/actions/team/queries";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePagePermission("users");

  const [users, roles, teamMembers, availableClients] = await Promise.all([
    listAppUsers(),
    listRoleOptions(),
    listTeamMemberOptions(),
    listAvailableClientOptions(),
  ]);

  const teamMemberOptions = teamMembers.map((m) => ({ id: m.id, name: m.name }));
  const availableClientOptions = availableClients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Users</h1>
          <p className="text-sm text-muted-foreground">
            Sign-up is disabled — this is the only way to create a new
            account: dashboard handler, team login, or client login.
          </p>
        </div>
        <UserDialog roles={roles} teamMembers={teamMemberOptions} clients={availableClientOptions} />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Role / Team member / Client profile(s)</TableHead>
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
            {users.map((user) => {
              const ownClientOptions = user.clientProfiles.map((p) => p.client);
              const editClientOptions = [
                ...ownClientOptions,
                ...availableClientOptions.filter(
                  (c) => !ownClientOptions.some((o) => o.id === c.id),
                ),
              ];

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.kind === "DASHBOARD_HANDLER"
                      ? "Dashboard handler"
                      : user.kind === "TEAM"
                        ? "Team login"
                        : "Client login"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.role?.name ??
                      user.teamMember?.name ??
                      (ownClientOptions.length > 0
                        ? ownClientOptions.map((c) => c.name).join(", ")
                        : "—")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <UserRowActions
                        user={{
                          id: user.id,
                          name: user.name,
                          email: user.email,
                          kind: user.kind,
                          roleId: user.roleId,
                          teamMemberId: user.teamMemberId,
                          clientIds: ownClientOptions.map((c) => c.id),
                        }}
                        roles={roles}
                        teamMembers={teamMemberOptions}
                        clients={editClientOptions}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
