"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/ui/toast";
import { ACTION_REGISTRY } from "@/lib/sync/actions-registry";
import { isLikelyNetworkError } from "@/lib/sync/mutate";
import { getQueue, removeFromQueue, bumpAttempts, subscribeQueue } from "@/lib/sync/queue";

const RETRY_INTERVAL_MS = 15_000;
// ~5 minutes of retrying at the interval above before giving up on an
// entry that keeps failing for a non-network reason.
const MAX_ATTEMPTS = 20;

/** Mounted once in the root layout — drains the offline mutation queue
 * (lib/sync/queue.ts) on load, whenever the browser comes back online, and
 * on a periodic fallback timer, so a create/update/delete that couldn't
 * reach the server earlier (see lib/sync/mutate.ts) gets retried in the
 * background without the user having to do anything, the same way a
 * pending WhatsApp message sends itself once you're back online. */
export function SyncProvider() {
  const router = useRouter();
  const drainingRef = React.useRef(false);

  const drain = React.useCallback(async () => {
    if (drainingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    drainingRef.current = true;
    try {
      const queue = getQueue();
      let changed = false;
      for (const item of queue) {
        const run = ACTION_REGISTRY[item.actionKey];
        if (!run) {
          // Unrecognized action key (e.g. left over from an older deploy)
          // — drop it rather than retry something that no longer exists.
          removeFromQueue(item.id);
          continue;
        }
        try {
          await run(item.payload);
          removeFromQueue(item.id);
          changed = true;
          toast.add({ title: `Synced "${item.label}"`, type: "success", timeout: 2500 });
        } catch (error) {
          if (isLikelyNetworkError(error)) {
            // Still offline-ish — stop this pass, the next tick will retry
            // from here (queue order is preserved).
            break;
          }
          bumpAttempts(item.id);
          if (item.attempts + 1 >= MAX_ATTEMPTS) {
            removeFromQueue(item.id);
            toast.add({
              title: `Couldn't sync "${item.label}"`,
              description: error instanceof Error ? error.message : "Unknown error",
              type: "error",
              timeout: 6000,
            });
          }
        }
      }
      if (changed) router.refresh();
    } finally {
      drainingRef.current = false;
    }
  }, [router]);

  React.useEffect(() => {
    drain();
    const unsubscribe = subscribeQueue(() => drain());
    const interval = setInterval(drain, RETRY_INTERVAL_MS);
    window.addEventListener("online", drain);
    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("online", drain);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drain is stable enough (only depends on router) and re-subscribing on every render would defeat the point.
  }, []);

  return null;
}
