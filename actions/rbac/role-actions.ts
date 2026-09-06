"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { PAGE_KEYS, type PageKey } from "@/lib/rbac/pages";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

type PermissionInput = {
  page: PageKey;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

/** Reads the role-editor's checkbox matrix — one row per PAGE_REGISTRY
 * entry, checkbox names "perm_<page>_view" etc. Rows with every box
 * unchecked are dropped rather than stored as an all-false row. */
function readPermissions(formData: FormData): PermissionInput[] {
  return PAGE_KEYS.map((page) => ({
    page,
    canView: formData.get(`perm_${page}_view`) === "on",
    canCreate: formData.get(`perm_${page}_create`) === "on",
    canEdit: formData.get(`perm_${page}_edit`) === "on",
    canDelete: formData.get(`perm_${page}_delete`) === "on",
  })).filter((p) => p.canView || p.canCreate || p.canEdit || p.canDelete);
}

export async function createRole(formData: FormData) {
  await requirePagePermission("roles", "create");

  const name = str(formData, "name");
  if (!name) throw new Error("Name is required");

  const permissions = readPermissions(formData);

  await prisma.role.create({
    data: {
      name,
      permissions: { create: permissions },
    },
  });

  revalidatePath("/admin/roles");
}

export async function updateRole(id: string, formData: FormData) {
  await requirePagePermission("roles", "edit");

  const name = str(formData, "name");
  if (!name) throw new Error("Name is required");

  const permissions = readPermissions(formData);

  await prisma.role.update({
    where: { id },
    data: {
      name,
      permissions: {
        deleteMany: {},
        create: permissions,
      },
    },
  });

  revalidatePath("/admin/roles");
}

export async function deleteRole(id: string) {
  await requirePagePermission("roles", "delete");

  const usersCount = await prisma.appUser.count({ where: { roleId: id } });
  if (usersCount > 0) {
    throw new Error(
      `Can't delete a role assigned to ${usersCount} user${usersCount === 1 ? "" : "s"}`,
    );
  }

  await prisma.role.delete({ where: { id } });

  revalidatePath("/admin/roles");
}
