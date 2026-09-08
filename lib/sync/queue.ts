"use client";

// A tiny persisted mutation queue — when a create/update/delete can't reach
// the server (offline, or a fetch-level failure), it's stored here as a
// plain serializable record (action key + JSON payload, never a closure)
// so it survives a reload and can be replayed once connectivity returns.
// See lib/sync/actions-registry.ts for the action-key → function mapping,
// and lib/sync/mutate.ts for the public enqueue API dialogs actually call.

export type QueuedMutation = {
  id: string;
  actionKey: string;
  payload: unknown;
  label: string;
  createdAt: number;
  attempts: number;
};

const STORAGE_KEY = "techstersol.mutationQueue.v1";

type Listener = (queue: QueuedMutation[]) => void;
const listeners = new Set<Listener>();

function readQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Storage full/unavailable (e.g. private browsing) — the queue still
      // works in-memory for this tab via the listeners below, it just
      // won't survive a reload.
    }
  }
  listeners.forEach((listener) => listener(queue));
}

export function getQueue(): QueuedMutation[] {
  return readQueue();
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pushToQueue(
  entry: Pick<QueuedMutation, "actionKey" | "payload" | "label">,
): QueuedMutation {
  const item: QueuedMutation = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
  };
  writeQueue([...readQueue(), item]);
  return item;
}

export function removeFromQueue(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function bumpAttempts(id: string) {
  writeQueue(
    readQueue().map((item) => (item.id === id ? { ...item, attempts: item.attempts + 1 } : item)),
  );
}
