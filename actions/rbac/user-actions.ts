"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import type { AppUserStatus } from "@/generated/prisma/client";
import { requirePagePermission } from "@/lib/rbac/permissions";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const APP_USER_STATUSES: AppUserStatus[] = ["ACTIVE", "SUSPENDED", "BLOCKED"];

function readStatus(formData: FormData): AppUserStatus {
  const raw = str(formData, "status");
  return APP_USER_STATUSES.includes(raw as AppUserStatus) ? (raw as AppUserStatus) : "ACTIVE";
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
    data: { authUserId, email, name, kind: "DASHBOARD_HANDLER", roleId, status: readStatus(formData) },
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
    data: { authUserId, email, name, kind: "TEAM", teamMemberId, status: readStatus(formData) },
  });

  revalidatePath("/admin/users");
}

export async function createClientUser(formData: FormData) {
  await requirePagePermission("users", "create");

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const clientIds = [...new Set(formData.getAll("clientId").map((v) => String(v).trim()))].filter(
    Boolean,
  );
  validateBasics(name, email, password);
  if (clientIds.length === 0) throw new Error("At least one client profile is required");

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    include: { clientProfiles: true },
  });
  if (clients.length !== clientIds.length) {
    throw new Error("One or more selected clients no longer exist");
  }
  if (clients.some((c) => c.clientProfiles.length > 0)) {
    throw new Error("One or more selected clients already have a login");
  }

  const authUserId = await createAuthAccount(name, email, password);

  await prisma.$transaction(async (tx) => {
    const appUser = await tx.appUser.create({
      data: { authUserId, email, name, kind: "CLIENT", status: readStatus(formData) },
    });
    await tx.clientProfile.createMany({
      data: clientIds.map((clientId) => ({ appUserId: appUser.id, clientId })),
    });
  });

  revalidatePath("/admin/users");
}

/** Edits name/email/password and the kind-specific link (role, team
 * member, or client profile set) of an existing login. The user's `kind`
 * itself never changes here — switching kinds would mean re-deriving a
 * different relational shape entirely, so that's a delete-and-recreate,
 * not an edit. */
export async function updateAppUser(id: string, formData: FormData) {
  await requirePagePermission("users", "edit");

  const appUser = await prisma.appUser.findUnique({ where: { id } });
  if (!appUser) throw new Error("User not found");

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const status = readStatus(formData);
  if (!name || !email) throw new Error("Name and email are required");
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address");
  if (password && password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  // Reactivating gives a clean slate rather than an immediate re-block —
  // an admin choosing Active clearly means "let them try again".
  const lockoutReset =
    status === "ACTIVE"
      ? { failedLoginAttempts: 0, lockoutStage: 0, lockedUntil: null }
      : {};

  if (name !== appUser.name || email !== appUser.email) {
    const { error } = await auth.admin.updateUser({
      userId: appUser.authUserId,
      data: { name, email },
    });
    if (error) throw new Error(error.message ?? "Could not update the account");
  }
  if (password) {
    const { error } = await auth.admin.setUserPassword({
      userId: appUser.authUserId,
      newPassword: password,
    });
    if (error) throw new Error(error.message ?? "Could not set the new password");
  }

  if (appUser.kind === "DASHBOARD_HANDLER") {
    const roleId = str(formData, "roleId");
    if (!roleId) throw new Error("Role is required");
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error("Selected role no longer exists");
    await prisma.appUser.update({
      where: { id },
      data: { name, email, roleId, status, ...lockoutReset },
    });
  } else if (appUser.kind === "TEAM") {
    const teamMemberId = str(formData, "teamMemberId");
    if (!teamMemberId) throw new Error("Team member is required");
    const teamMember = await prisma.teamMember.findUnique({ where: { id: teamMemberId } });
    if (!teamMember) throw new Error("Selected team member no longer exists");
    await prisma.appUser.update({
      where: { id },
      data: { name, email, teamMemberId, status, ...lockoutReset },
    });
  } else {
    const clientIds = [
      ...new Set(formData.getAll("clientId").map((v) => String(v).trim())),
    ].filter(Boolean);
    if (clientIds.length === 0) throw new Error("At least one client profile is required");

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      include: { clientProfiles: true },
    });
    if (clients.length !== clientIds.length) {
      throw new Error("One or more selected clients no longer exist");
    }
    if (clients.some((c) => c.clientProfiles.some((p) => p.appUserId !== id))) {
      throw new Error("One or more selected clients already have a login");
    }

    await prisma.$transaction(async (tx) => {
      await tx.appUser.update({ where: { id }, data: { name, email, status, ...lockoutReset } });
      await tx.clientProfile.deleteMany({
        where: { appUserId: id, clientId: { notIn: clientIds } },
      });
      const existing = await tx.clientProfile.findMany({
        where: { appUserId: id },
        select: { clientId: true },
      });
      const existingIds = new Set(existing.map((e) => e.clientId));
      const toAdd = clientIds.filter((cid) => !existingIds.has(cid));
      if (toAdd.length > 0) {
        await tx.clientProfile.createMany({
          data: toAdd.map((clientId) => ({ appUserId: id, clientId })),
        });
      }
    });
  }

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
