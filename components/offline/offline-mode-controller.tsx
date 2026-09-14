"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  isOfflineModeEnabled,
  subscribeOfflineMode,
} from "@/lib/offline/settings";

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
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
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
  const router = useRouter();

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

  // app/sw.ts serves a visited page's last-cached RSC/HTML instantly, then
  // refreshes it in the background (StaleWhileRevalidate) and — only if the
  // refreshed copy actually differs — broadcasts a CACHE_UPDATED message via
  // BroadcastUpdatePlugin. When that update is for the page currently on
  // screen, re-render it in place with the newer data, the same "load what
  // you have, then quietly update" feel as an email inbox, with no user
  // action needed.
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "CACHE_UPDATED") return;
      const updatedURL: string | undefined = event.data.payload?.updatedURL;
      if (!updatedURL) return;
      try {
        if (new URL(updatedURL).pathname === window.location.pathname) {
          router.refresh();
        }
      } catch {
        // Malformed URL in the broadcast payload — nothing to refresh.
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
