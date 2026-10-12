"use client";

import { runMutation } from "@/actions/sync/run-mutation";
import { isActionKey, type ActionKey } from "@/lib/sync/action-keys";

export type { ActionKey };

/** Every in-scope dialog's onSubmit gets a FormData and converts it to a
 * plain object with this before handing it to enqueueMutation — FormData
 * isn't JSON-serializable, and queued payloads must be. */
export function formDataToRecord(formData: FormData): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

/** Runs a registered mutation (see lib/sync/server-actions.ts). Throws an
 * Error carrying the server's own message when it rejects — e.g.
 * "Name, phone, email, and country are required" — rather than the opaque
 * production "#441" a directly-thrown server action error becomes. Returns
 * false for a key the server no longer knows (left over in the offline
 * queue from an older version). */
export async function runRegisteredAction(
  key: string,
  payload: unknown,
): Promise<boolean> {
  if (!isActionKey(key)) return false;
  const result = await runMutation(key, payload);
  if (!result.ok) throw new Error(result.error);
  return true;
}
