/// <reference lib="webworker" />

import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { BroadcastUpdatePlugin, ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Serwist's own `defaultCache` rules are NetworkFirst for pages/RSC —
// correct, but it means even a page you've already visited waits on a full
// network round trip before showing anything, so there's no "instant" feel
// while online. Routes match in registration order and the first match
// wins, so these three rules (same matchers Serwist itself uses for
// PAGES_CACHE_NAME.rscPrefetch/rsc/html, just swapping the strategy) take
// priority over the equivalent ones inside `defaultCache` below: the
// last-cached version of a visited page/RSC payload paints immediately, a
// background fetch refreshes the cache, and BroadcastUpdatePlugin tells any
// open tab when that refreshed content actually differs so the app can
// re-render in place (see components/offline/offline-mode-controller.tsx) —
// the same "show what you have, then quietly update" feel as an email inbox.
const instantPageCache: RuntimeCaching[] = [
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      request.headers.get("RSC") === "1" &&
      request.headers.get("Next-Router-Prefetch") === "1" &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new StaleWhileRevalidate({
      cacheName: PAGES_CACHE_NAME.rscPrefetch,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 1440 * 60 }),
        new BroadcastUpdatePlugin(),
      ],
    }),
  },
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      request.headers.get("RSC") === "1" && sameOrigin && !pathname.startsWith("/api/"),
    handler: new StaleWhileRevalidate({
      cacheName: PAGES_CACHE_NAME.rsc,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 1440 * 60 }),
        new BroadcastUpdatePlugin(),
      ],
    }),
  },
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      !!request.headers.get("Content-Type")?.includes("text/html") &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new StaleWhileRevalidate({
      cacheName: PAGES_CACHE_NAME.html,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 1440 * 60 }),
        new BroadcastUpdatePlugin(),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...instantPageCache, ...defaultCache],
});

serwist.addEventListeners();
