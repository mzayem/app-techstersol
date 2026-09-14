import { UserDialog, UserRowActions } from "@/components/rbac/user-dialog";
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
import { requirePagePermission } from "@/lib/rbac/permissions";
import {
  listAppUsers,
  listAvailableClientOptions,
  listPartnerOptions,
} from "@/actions/rbac/user-queries";
import { listRoleOptions } from "@/actions/rbac/role-queries";
import { listTeamMemberOptions } from "@/actions/team/queries";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission("users");
  const params = await searchParams;

  const [users, roles, teamMembers, availableClients, partners] =
    await Promise.all([
      listAppUsers(),
      listRoleOptions(),
      listTeamMemberOptions(),
      listAvailableClientOptions(),
      listPartnerOptions(),
    ]);

  const teamMemberOptions = teamMembers.map((m) => ({
    id: m.id,
    name: m.name,
  }));
  const availableClientOptions = availableClients.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));
  const paginated = paginate(
    users,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Users</h1>
          <p className="text-sm text-muted-foreground">
            Sign-up is disabled — this is the only way to create a new account:
            dashboard handler, team login, or client login.
          </p>
        </div>
        <UserDialog
          roles={roles}
          teamMembers={teamMemberOptions}
          clients={availableClientOptions}
          partners={partnerOptions}
        />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role / Team member / Client profile(s)</TableHead>
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
                  No users yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((user) => {
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
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.kind === "DASHBOARD_HANDLER"
                      ? "Dashboard handler"
                      : user.kind === "TEAM"
                        ? "Team login"
                        : user.kind === "PARTNER"
                          ? "Partner login"
                          : "Client login"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <StatusPill status={user.status} />
                      {user.lockedMinutesRemaining !== null && (
                        <span className="text-xs text-muted-foreground">
                          Locked {user.lockedMinutesRemaining} min
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.role?.name ??
                      user.teamMember?.name ??
                      user.partner?.name ??
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
                          status: user.status,
                          roleId: user.roleId,
                          teamMemberId: user.teamMemberId,
                          partnerId: user.partnerId,
                          clientIds: ownClientOptions.map((c) => c.id),
                        }}
                        roles={roles}
                        teamMembers={teamMemberOptions}
                        partners={partnerOptions}
                        clients={editClientOptions}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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

function StatusPill({
  status,
}: {
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED";
}) {
  const styles = {
    ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    SUSPENDED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    BLOCKED: "bg-red-500/10 text-red-600 dark:text-red-400",
  } as const;
  const labels = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    BLOCKED: "Blocked",
  } as const;

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
