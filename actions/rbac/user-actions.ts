"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBasics(name: string, email: string, password: string) {
  if (!name || !email || !password) {
    throw new Error("Name, email, and password are required");
  }
  if (!EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
}

async function createAuthAccount(
  name: string,
  email: string,
  password: string,
) {
  const { data, error } = await auth.admin.createUser({
    email,
    password,
    name,
  });
  if (error || !data?.user) {
    throw new Error(error?.message ?? "Could not create the account");
  }
  return data.user.id;
}

export async function createDashboardUser(formData: FormData) {
  await requirePagePermission("users", "create");

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const roleId = str(formData, "roleId");
  validateBasics(name, email, password);
  if (!roleId) throw new Error("Role is required");

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Selected role no longer exists");

  const authUserId = await createAuthAccount(name, email, password);

  await prisma.appUser.create({
    data: { authUserId, email, name, kind: "DASHBOARD_HANDLER", roleId },
  });

  revalidatePath("/admin/users");
}

export async function createTeamUser(formData: FormData) {
  await requirePagePermission("users", "create");

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const teamMemberId = str(formData, "teamMemberId");
  validateBasics(name, email, password);
  if (!teamMemberId) throw new Error("Team member is required");

  const teamMember = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
  });
  if (!teamMember) throw new Error("Selected team member no longer exists");

  const authUserId = await createAuthAccount(name, email, password);

  await prisma.appUser.create({
    data: { authUserId, email, name, kind: "TEAM", teamMemberId },
  });

  revalidatePath("/admin/users");
}

/** Revokes dashboard/portal access by removing our own record — this
 * does not delete the underlying Neon Auth account, so if they ever sign
 * in again they'll simply have no AppUser and be treated as unauthorized. */
export async function deleteAppUser(id: string) {
  await requirePagePermission("users", "delete");

  await prisma.appUser.delete({ where: { id } });

  revalidatePath("/admin/users");
}
