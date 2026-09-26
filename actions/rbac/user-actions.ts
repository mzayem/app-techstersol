"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import type { AppUserStatus } from "@/generated/prisma/client";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";

const KIND_LABELS: Record<string, string> = {
  DASHBOARD_HANDLER: "dashboard",
  TEAM: "team",
  CLIENT: "client",
  PARTNER: "partner",
};
import { createCredentialLink } from "@/lib/mail/credential-link";
import { sendMail } from "@/lib/mail/transport";
import { renderCredentialsEmail } from "@/lib/mail/templates/credentials";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const APP_USER_STATUSES: AppUserStatus[] = ["ACTIVE", "SUSPENDED", "BLOCKED"];

function readStatus(formData: FormData): AppUserStatus {
  const raw = str(formData, "status");
  return APP_USER_STATUSES.includes(raw as AppUserStatus)
    ? (raw as AppUserStatus)
    : "ACTIVE";
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
  // displayName is set explicitly (mirroring name) because leaving it unset
  // appears to trigger a bug in @neondatabase/auth-ui's UserAvatar/UserButton,
  // which fall back through `user.displayName || user.name || ...` — with no
  // plain displayName value, that first read seems to return something that
  // isn't a real string, producing phantom /api/auth/display-name/* requests
  // and a hydration mismatch in the sidebar's NavUser. Harmless either way.
  const { data, error } = await auth.admin.createUser({
    email,
    password,
    name,
    data: { displayName: name },
  });
  if (error || !data?.user) {
    throw new Error(error?.message ?? "Could not create the account");
  }
  return data.user.id;
}

/** Mints a one-time view link for the given plaintext password and emails
 * it. Failures here are logged, not thrown — the account itself is
 * already created/updated by the time this runs, and a transient mail
 * outage shouldn't undo that; an admin can always resend from the Users
 * page (`sendCredentialsEmail` below). */
async function sendCredentialsMail(
  appUserId: string,
  name: string,
  email: string,
  password: string,
) {
  try {
    const token = await createCredentialLink(appUserId, password);
    const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/credentials/${token}`;
    await sendMail({
      to: email,
      subject: "Your Techstersol account",
      html: renderCredentialsEmail({ name, email, viewUrl }),
    });
  } catch (err) {
    console.error("Failed to send credentials email:", err);
  }
}

function generatePassword() {
  return randomBytes(9).toString("base64url");
}

export async function createDashboardUser(formData: FormData) {
  const { appUser: actor } = await requirePagePermission("users", "create");

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const roleId = str(formData, "roleId");
  validateBasics(name, email, password);
  if (!roleId) throw new Error("Role is required");

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Selected role no longer exists");

  const authUserId = await createAuthAccount(name, email, password);

  const appUser = await prisma.appUser.create({
    data: {
      authUserId,
      email,
      name,
      kind: "DASHBOARD_HANDLER",
      roleId,
      status: readStatus(formData),
    },
  });
  await sendCredentialsMail(appUser.id, name, email, password);
  await logActivity(actor, {
    action: "created",
    entityType: "user",
    entityId: appUser.id,
    summary: `Created ${KIND_LABELS[appUser.kind]} login for "${name}" (${email})`,
    page: "users",
  });

  revalidatePath("/admin/users");
}

export async function createTeamUser(formData: FormData) {
  const { appUser: actor } = await requirePagePermission("users", "create");

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

  const appUser = await prisma.appUser.create({
    data: {
      authUserId,
      email,
      name,
      kind: "TEAM",
      teamMemberId,
      status: readStatus(formData),
    },
  });
  await sendCredentialsMail(appUser.id, name, email, password);
  await logActivity(actor, {
    action: "created",
    entityType: "user",
    entityId: appUser.id,
    summary: `Created ${KIND_LABELS[appUser.kind]} login for "${name}" (${email})`,
    page: "users",
  });

  revalidatePath("/admin/users");
}

export async function createPartnerUser(formData: FormData) {
  const { appUser: actor } = await requirePagePermission("users", "create");

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const partnerId = str(formData, "partnerId");
  validateBasics(name, email, password);
  if (!partnerId) throw new Error("Partner is required");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new Error("Selected partner no longer exists");

  const authUserId = await createAuthAccount(name, email, password);

  const appUser = await prisma.appUser.create({
    data: {
      authUserId,
      email,
      name,
      kind: "PARTNER",
      partnerId,
      status: readStatus(formData),
    },
  });
  await sendCredentialsMail(appUser.id, name, email, password);
  await logActivity(actor, {
    action: "created",
    entityType: "user",
    entityId: appUser.id,
    summary: `Created ${KIND_LABELS[appUser.kind]} login for "${name}" (${email})`,
    page: "users",
  });

  revalidatePath("/admin/users");
}

export async function createClientUser(formData: FormData) {
  const { appUser: actor } = await requirePagePermission("users", "create");

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const clientIds = [
    ...new Set(formData.getAll("clientId").map((v) => String(v).trim())),
  ].filter(Boolean);
  validateBasics(name, email, password);
  if (clientIds.length === 0)
    throw new Error("At least one client profile is required");

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

  const appUser = await prisma.$transaction(async (tx) => {
    const created = await tx.appUser.create({
      data: {
        authUserId,
        email,
        name,
        kind: "CLIENT",
        status: readStatus(formData),
      },
    });
    await tx.clientProfile.createMany({
      data: clientIds.map((clientId) => ({ appUserId: created.id, clientId })),
    });
    return created;
  });
  await sendCredentialsMail(appUser.id, name, email, password);
  await logActivity(actor, {
    action: "created",
    entityType: "user",
    entityId: appUser.id,
    summary: `Created ${KIND_LABELS[appUser.kind]} login for "${name}" (${email})`,
    page: "users",
  });

  revalidatePath("/admin/users");
}

/** Edits name/email/password and the kind-specific link (role, team
 * member, or client profile set) of an existing login. The user's `kind`
 * itself never changes here — switching kinds would mean re-deriving a
 * different relational shape entirely, so that's a delete-and-recreate,
 * not an edit. */
export async function updateAppUser(id: string, formData: FormData) {
  const { appUser: actor } = await requirePagePermission("users", "edit");

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
      data: { name, email, displayName: name },
    });
    if (error) throw new Error(error.message ?? "Could not update the account");
  }
  if (password) {
    const { error } = await auth.admin.setUserPassword({
      userId: appUser.authUserId,
      newPassword: password,
    });
    if (error)
      throw new Error(error.message ?? "Could not set the new password");
    await sendCredentialsMail(appUser.id, name, email, password);
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
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: teamMemberId },
    });
    if (!teamMember) throw new Error("Selected team member no longer exists");
    await prisma.appUser.update({
      where: { id },
      data: { name, email, teamMemberId, status, ...lockoutReset },
    });
  } else if (appUser.kind === "PARTNER") {
    const partnerId = str(formData, "partnerId");
    if (!partnerId) throw new Error("Partner is required");
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) throw new Error("Selected partner no longer exists");
    await prisma.appUser.update({
      where: { id },
      data: { name, email, partnerId, status, ...lockoutReset },
    });
  } else {
    const clientIds = [
      ...new Set(formData.getAll("clientId").map((v) => String(v).trim())),
    ].filter(Boolean);
    if (clientIds.length === 0)
      throw new Error("At least one client profile is required");

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
      await tx.appUser.update({
        where: { id },
        data: { name, email, status, ...lockoutReset },
      });
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

  const changes = [
    appUser.status !== status ? `status ${appUser.status} → ${status}` : null,
    appUser.kind === "DASHBOARD_HANDLER" &&
    str(formData, "roleId") !== appUser.roleId
      ? "role changed"
      : null,
    password ? "password reset" : null,
  ].filter(Boolean);
  await logActivity(actor, {
    action: "updated",
    entityType: "user",
    entityId: id,
    summary: `Edited ${KIND_LABELS[appUser.kind]} login "${name}" (${email})${changes.length > 0 ? ` — ${changes.join(", ")}` : ""}`,
    page: "users",
  });

  revalidatePath("/admin/users");
}

/** A manual "resend credentials" from the Users page. We never retain a
 * usable plaintext password once its one-time link is viewed or expires,
 * so this can't just resend the original — it generates a fresh random
 * password, sets it via Neon Auth, and emails a new one-time view link.
 * Effectively "reset & notify," not a no-op resend. */
export async function sendCredentialsEmail(id: string) {
  const { appUser: actor } = await requirePagePermission("users", "edit");

  const appUser = await prisma.appUser.findUnique({ where: { id } });
  if (!appUser) throw new Error("User not found");

  const password = generatePassword();
  const { error } = await auth.admin.setUserPassword({
    userId: appUser.authUserId,
    newPassword: password,
  });
  if (error) throw new Error(error.message ?? "Could not reset the password");

  await sendCredentialsMail(appUser.id, appUser.name, appUser.email, password);
  await logActivity(actor, {
    action: "sent-email",
    entityType: "user",
    entityId: id,
    summary: `Reset password and emailed new credentials to "${appUser.name}" (${appUser.email})`,
    page: "users",
  });
}

/** Revokes dashboard/portal access by removing our own record — this
 * does not delete the underlying Neon Auth account, so if they ever sign
 * in again they'll simply have no AppUser and be treated as unauthorized. */
export async function deleteAppUser(id: string) {
  const { appUser: actor } = await requirePagePermission("users", "delete");

  const removed = await prisma.appUser.delete({ where: { id } });

  await logActivity(actor, {
    action: "deleted",
    entityType: "user",
    entityId: id,
    summary: `Removed ${KIND_LABELS[removed.kind]} login "${removed.name}" (${removed.email})`,
    page: "users",
  });

  revalidatePath("/admin/users");
}
