"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";
import { issueApiKey } from "@/lib/api/keys";

/** Issues a key for a piece of software. The plaintext secret is returned
 * once, to be copied by the admin — only its hash is stored, so it can
 * never be shown again. */
export async function createApiKey(formData: FormData) {
  const { appUser } = await requirePagePermission("api-keys", "create");

  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new Error("Name is required");
  if (name.length > 100) throw new Error("Name is too long");

  // The name is the idempotency namespace for pushed earnings, so two live
  // keys must never share one. (Re-issuing after a revoke may reuse it —
  // that keeps already-pushed payments deduplicated.)
  const clash = await prisma.apiKey.findFirst({
    where: {
      name,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (clash) {
    throw new Error("An active key with this name already exists");
  }

  // Optional "YYYY-MM-DD": the key works through the end of that day in
  // the business timezone (Asia/Karachi, UTC+5 year-round).
  const expiresRaw = formData.get("expiresAt");
  const expiresDay = typeof expiresRaw === "string" ? expiresRaw.trim() : "";
  let expiresAt: Date | null = null;
  if (expiresDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresDay)) {
      throw new Error("Expiry must be a valid date");
    }
    expiresAt = new Date(`${expiresDay}T23:59:59.999+05:00`);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error("Expiry must be a valid date");
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw new Error("Expiry must be in the future");
    }
  }

  const { secret, keyHash, keyPrefix } = issueApiKey();
  const key = await prisma.apiKey.create({
    data: {
      name,
      expiresAt,
      keyHash,
      keyPrefix,
      createdByUserId: appUser.authUserId,
    },
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "api-key",
    entityId: key.id,
    summary: `Issued API key "${name}" (${keyPrefix}…)`,
    page: "api-keys",
  });

  revalidatePath("/admin/api-keys");
  return { secret };
}

export async function revokeApiKey(id: string) {
  const { appUser } = await requirePagePermission("api-keys", "edit");

  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) throw new Error("API key not found");
  if (existing.revokedAt) return;

  const key = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await logActivity(appUser, {
    action: "updated",
    entityType: "api-key",
    entityId: id,
    summary: `Revoked API key "${key.name}" (${key.keyPrefix}…)`,
    page: "api-keys",
  });

  revalidatePath("/admin/api-keys");
}

/** Only a revoked or expired key can be deleted — it's the safeguard against dropping
 * a live integration by accident. Earnings it pushed keep their `source`. */
export async function deleteApiKey(id: string) {
  const { appUser } = await requirePagePermission("api-keys", "delete");

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) throw new Error("API key not found");
  const expired = !!key.expiresAt && key.expiresAt.getTime() <= Date.now();
  if (!key.revokedAt && !expired) {
    throw new Error("Revoke the key before deleting it");
  }

  await prisma.apiKey.delete({ where: { id } });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "api-key",
    entityId: id,
    summary: `Deleted API key "${key.name}" (${key.keyPrefix}…)`,
    page: "api-keys",
  });

  revalidatePath("/admin/api-keys");
}
