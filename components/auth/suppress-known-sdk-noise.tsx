"use client";

import * as React from "react";

/** Every place this app itself calls the Neon Auth client destructures
 * `{ data, error }` rather than letting a rejection propagate (see
 * lib/auth-client.ts's call sites) — so any AuthApiError that reaches the
 * window as an unhandled rejection is, by construction, coming from
 * somewhere inside the SDK's own internals, not our code. In practice
 * that's a known, harmless bug: @neondatabase/auth-ui's user-display
 * resolution (`user.displayName || user.name || ...`, used by UserAvatar/
 * UserButton/UserView and by AccountView's internal cards) reads a
 * `displayName` value that appears to trigger a real (failing) network
 * request instead of just returning a plain value — producing
 * `GET /api/auth/display-name/to-string` / `/value-of` 404s and the
 * matching hydration warning. It doesn't break anything functionally; this
 * just stops it from surfacing as a scary uncaught-exception console
 * error while the actual SDK bug is tracked upstream. Logged at debug
 * level (not swallowed entirely) so it's still discoverable if needed. */
export function SuppressKnownSdkNoise() {
  React.useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason as { name?: string; status?: number } | undefined;
      if (reason?.name === "AuthApiError") {
        event.preventDefault();
        console.debug(
          "[known-sdk-issue] Suppressed an AuthApiError from @neondatabase/auth-ui internals" +
            " (status " +
            reason.status +
            ") — see components/auth/suppress-known-sdk-noise.tsx for context.",
        );
      }
    }

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return null;
}
