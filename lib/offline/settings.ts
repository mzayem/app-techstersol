"use client";

// The offline-mode toggle, stored client-only (not in the database): it has
// to be readable with zero network, since it gates whether the app even
// attempts service-worker registration and cache reads. Mirrors the shape
// of lib/sync/queue.ts's own localStorage + pub/sub pattern.

const STORAGE_KEY = "techstersol.offlineMode.v1";

type Listener = (enabled: boolean) => void;
const listeners = new Set<Listener>();

export function isOfflineModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOfflineModeEnabled(enabled: boolean) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // Storage full/unavailable (e.g. private browsing) — the in-memory
      // listeners below still fire for this tab, it just won't persist.
    }
  }
  listeners.forEach((listener) => listener(enabled));
}

export function subscribeOfflineMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
