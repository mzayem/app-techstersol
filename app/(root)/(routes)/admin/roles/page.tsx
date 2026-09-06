import { RoleDialog, RoleRowActions } from "@/components/rbac/role-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { PAGE_REGISTRY } from "@/lib/rbac/pages";
import { listRoles } from "@/actions/rbac/role-queries";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requirePagePermission("roles");

  const roles = await listRoles();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Control which pages a dashboard user can view, and whether they
            can create, edit, or delete on each one.
          </p>
        </div>
        <RoleDialog />
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Pages with access</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No roles yet.
                </TableCell>
              </TableRow>
            )}
            {roles.map((role) => {
              const entry = {
                id: role.id,
                name: role.name,
                permissions: role.permissions,
                userCount: role._count.users,
              };
              return (
                <RoleRowActions key={role.id} entry={entry}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.permissions.filter((p) => p.canView).length} of{" "}
                    {PAGE_REGISTRY.length} pages
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {role._count.users}
                  </TableCell>
                </RoleRowActions>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
