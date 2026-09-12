"use client";

import { toast } from "@/components/ui/toast";
import { ACTION_REGISTRY, type ActionKey } from "@/lib/sync/actions-registry";
import { pushToQueue } from "@/lib/sync/queue";

/** Distinguishes "the network dropped the request" from "the server
 * rejected it" — a real validation error (e.g. a required field missing)
 * should still surface inline in the form right away; a fetch-level
 * failure or being visibly offline is what actually gets queued. */
export function isLikelyNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof Error && /failed to fetch|network/i.test(error.message)) return true;
  return false;
}

/** The single entry point every in-scope dialog calls instead of awaiting
 * a server action directly. On success (or once genuinely queued), the
 * caller should treat this like a normal successful submit — close the
 * dialog, reset the form — the toast (and, for queued items, the
 * background sync in components/sync/sync-provider.tsx) takes over from
 * there. Only a real, non-network rejection is returned as `ok: false`,
 * so the caller can keep the dialog open and show the message inline. */
export async function enqueueMutation<P>({
  key,
  payload,
  label,
}: {
  key: ActionKey;
  payload: P;
  label: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const toastId = toast.add({ title: `Saving ${label}…`, type: "loading", timeout: 0 });
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (!offline) {
    try {
      await ACTION_REGISTRY[key](payload);
      toast.update(toastId, { title: `Saved ${label}`, type: "success", timeout: 2000 });
      return { ok: true };
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        toast.update(toastId, { title: message, type: "error", timeout: 5000 });
        return { ok: false, error: message };
      }
      // Fetch-level failure — fall through and queue it below instead of
      // blocking the user on a network hiccup.
    }
  }

  pushToQueue({ actionKey: key, payload, label });
  toast.update(toastId, {
    title: `"${label}" will sync when you're back online`,
    type: "info",
    timeout: 4000,
  });
  return { ok: true };
}
