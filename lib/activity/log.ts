import { prisma } from "@/lib/prisma";
import type { PageKey } from "@/lib/rbac/pages";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "marked-paid"
  | "marked-unpaid"
  | "status-changed"
  | "sent-email"
  | "reminder-sent"
  | "reminders-toggled";

/** Anyone with a name — a CurrentAppUser, or null for the system itself
 * (the reminder job and other unattended work). */
export type ActivityActor = {
  id: string;
  name: string;
  email: string;
} | null;

/** Appends one row to the activity log. Never throws — the audit trail is
 * best-effort, and a failed log write must not roll back or fail the real
 * change the caller has already made. Call it after the change succeeds. */
export async function logActivity(
  actor: ActivityActor,
  entry: {
    action: ActivityAction;
    entityType: string;
    entityId?: string | null;
    summary: string;
    page?: PageKey;
  },
) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? "System",
        actorEmail: actor?.email ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        page: entry.page ?? null,
      },
    });
  } catch (err) {
    console.error("[activity] failed to write log entry:", err);
  }
}
