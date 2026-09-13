"use client";

import * as React from "react";

import { isOfflineModeEnabled, subscribeOfflineMode } from "@/lib/offline/settings";

declare global {
  interface Window {
    serwist?: { register: () => Promise<unknown> };
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    if (window.serwist) {
      // Present but not auto-registered (next.config.ts sets `register: false`)
      // — see app/sw.ts.
      await window.serwist.register();
    } else {
      await navigator.serviceWorker.register("/sw.js");
    }
  } catch {
    // Registration can fail (e.g. no production build, or the browser
    // blocked it) — offline mode just won't do anything in that case.
  }
}

async function unregisterServiceWorkerAndClearCaches() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if (typeof caches !== "undefined") {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

/** Mounted once in the root layout — turns the service worker on or off to
 * match the "Data & Offline" settings toggle (lib/offline/settings.ts).
 * Off by default: nothing here runs unless the user has opted in. */
export function OfflineModeController() {
  React.useEffect(() => {
    function apply(enabled: boolean) {
      if (enabled) {
        void registerServiceWorker();
      } else {
        void unregisterServiceWorkerAndClearCaches();
      }
    }

    apply(isOfflineModeEnabled());
    return subscribeOfflineMode(apply);
  }, []);

  return null;
}
