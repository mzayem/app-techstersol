/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Precaches the build's static assets (tying the cache to the exact deploy,
// so a new version evicts the old one) and, via `defaultCache`, applies
// Serwist's own Next.js runtime-caching rules — NetworkFirst for
// pages/RSC responses so a previously-visited screen's last-seen data
// renders with no network, and it already excludes /api/auth/* so
// sign-in/session requests are never served from cache.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
