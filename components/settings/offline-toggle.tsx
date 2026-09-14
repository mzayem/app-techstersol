"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  isOfflineModeEnabled,
  setOfflineModeEnabled,
  subscribeOfflineMode,
} from "@/lib/offline/settings";

function getServerSnapshot() {
  return false;
}

/** The one control in the "Data & Offline" settings group for now — flips
 * lib/offline/settings.ts, which components/offline/offline-mode-controller.tsx
 * (mounted in the root layout) reacts to by registering/unregistering the
 * service worker. Off by default; nothing here runs until a user turns it
 * on themselves. Reads the localStorage-backed setting via
 * useSyncExternalStore, since it's external, client-only state with no
 * meaningful value during SSR. */
export function OfflineToggle() {
  const enabled = React.useSyncExternalStore(
    subscribeOfflineMode,
    isOfflineModeEnabled,
    getServerSnapshot,
  );

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="offline-mode-toggle">
          Enable offline mode for this device
        </Label>
        <p className="text-sm text-muted-foreground">
          Caches the app and your last-seen data locally so it still opens with
          no connection. Any create or update you make offline is saved locally
          and synced automatically once you&apos;re back online. Uses additional
          local storage on this device; off by default.
        </p>
      </div>
      <Switch
        id="offline-mode-toggle"
        checked={enabled}
        onCheckedChange={setOfflineModeEnabled}
      />
    </div>
  );
}
