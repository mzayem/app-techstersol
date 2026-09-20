"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isOfflineModeEnabled,
  subscribeOfflineMode,
} from "@/lib/offline/settings";

function getOfflineModeServerSnapshot() {
  return false;
}

function subscribeOnlineStatus(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

/** Header widget shown only when "Enable offline mode for this device"
 * (components/settings/offline-toggle.tsx) is on — everyone else has
 * nothing cached locally, so there's nothing to flag or resync. The
 * yellow dot warns that the page may be showing data cached from a
 * previous visit (true whenever the browser is currently offline); the
 * refresh button re-runs the page's server render, which also gives
 * app/sw.ts's StaleWhileRevalidate handler a chance to fetch a fresh
 * copy in the background. */
export function SyncStatus() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const offlineModeEnabled = React.useSyncExternalStore(
    subscribeOfflineMode,
    isOfflineModeEnabled,
    getOfflineModeServerSnapshot,
  );
  const isOnline = React.useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    getOnlineServerSnapshot,
  );

  React.useEffect(() => {
    if (!refreshing) return;
    const timeout = setTimeout(() => setRefreshing(false), 600);
    return () => clearTimeout(timeout);
  }, [refreshing]);

  if (!offlineModeEnabled) return null;

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {!isOnline && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="size-2 shrink-0 rounded-full bg-yellow-500"
                aria-label="Offline"
              />
            }
          />
          <TooltipContent>Offline</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handleRefresh}
              aria-label="Refresh data"
            />
          }
        >
          <RefreshCwIcon
            className={cn("size-3.5", refreshing && "animate-spin")}
          />
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
    </div>
  );
}
