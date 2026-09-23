"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";

export type NotificationPreference =
  | "projectNotificationsEnabled"
  | "chatNotificationsEnabled";

/** Flips one of the signed-in staff login's own opt-in email alerts. Only
 * meaningful for a DASHBOARD_HANDLER whose role can view contracts — the
 * same gate the recipient query applies (lib/mail/notifications/
 * recipients.ts) — so anyone else is refused rather than silently storing a
 * preference that would never fire. */
export async function updateNotificationPreference(
  field: NotificationPreference,
  enabled: boolean,
) {
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("Not signed in");
  if (
    appUser.kind !== "DASHBOARD_HANDLER" ||
    !checkPermission(appUser, "contracts", "view")
  ) {
    throw new Error("Your role doesn't have access to projects");
  }
  if (
    field !== "projectNotificationsEnabled" &&
    field !== "chatNotificationsEnabled"
  ) {
    throw new Error("Unknown notification setting");
  }

  await prisma.appUser.update({
    where: { id: appUser.id },
    data: { [field]: enabled === true },
  });
  revalidatePath("/profile/settings");
}
