import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { type PageKey } from "@/lib/rbac/pages";

export type PermissionAction = "view" | "create" | "edit" | "delete";

export type PagePermission = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const NO_ACCESS: PagePermission = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
};

/** The signed-in identity, resolved from Neon Auth's session to our own
 * AppUser record — null if there's no session, or no matching AppUser
 * (shouldn't normally happen post-bootstrap, but a fresh Neon Auth account
 * an admin hasn't linked yet would land here). */
export async function getCurrentAppUser() {
  const { data } = await auth.getSession();
  if (!data?.user) return null;

  return prisma.appUser.findUnique({
    where: { authUserId: data.user.id },
    include: {
      role: { include: { permissions: true } },
      teamMember: { select: { id: true, name: true } },
    },
  });
}

export type CurrentAppUser = NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>>;

function resolvePermission(appUser: CurrentAppUser, page: PageKey): PagePermission {
  if (appUser.kind !== "DASHBOARD_HANDLER") return NO_ACCESS;
  const permission = appUser.role?.permissions.find((p) => p.page === page);
  if (!permission) return NO_ACCESS;
  return {
    canView: permission.canView,
    canCreate: permission.canCreate,
    canEdit: permission.canEdit,
    canDelete: permission.canDelete,
  };
}

/** Pure (non-redirecting) check — for call sites that need custom branching
 * instead of a blanket redirect, e.g. an action reachable from both the
 * dashboard (role-gated) and the team portal (owner-gated). */
export function checkPermission(
  appUser: CurrentAppUser,
  page: PageKey,
  action: PermissionAction,
): boolean {
  const permission = resolvePermission(appUser, page);
  return {
    view: permission.canView,
    create: permission.canCreate,
    edit: permission.canEdit,
    delete: permission.canDelete,
  }[action];
}

/** Call as the first statement in every dashboard page. Redirects a
 * TEAM-kind login to the portal, and redirects anyone whose role lacks
 * the given action on this page back to Overview. Returns the AppUser and
 * its resolved permission for this page, so a page can also use it to
 * conditionally render create/edit/delete controls. */
export async function requirePagePermission(page: PageKey, action: PermissionAction = "view") {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");
  if (appUser.kind === "TEAM") redirect("/portal");

  const permission = resolvePermission(appUser, page);
  const allowed = {
    view: permission.canView,
    create: permission.canCreate,
    edit: permission.canEdit,
    delete: permission.canDelete,
  }[action];

  if (!allowed) redirect("/");

  return { appUser, permission };
}

/** Call as the first statement in every team-portal page. Redirects
 * anyone who isn't a TEAM-kind login (or has no linked TeamMember) back
 * to the main dashboard. */
export async function requireTeamUser() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");
  if (appUser.kind !== "TEAM" || !appUser.teamMember) redirect("/");
  return appUser;
}

/** The page keys a dashboard-handler's role can view — used to filter the
 * sidebar nav. Empty for anything else (a TEAM login never sees this nav). */
export function getVisiblePages(appUser: CurrentAppUser): PageKey[] {
  if (appUser.kind !== "DASHBOARD_HANDLER") return [];
  return (appUser.role?.permissions.filter((p) => p.canView).map((p) => p.page) ??
    []) as PageKey[];
}
