"use client";

import * as React from "react";

import { Spinner } from "@/components/ui/spinner";

/** Fired by the auth provider's onSessionChange. The hosted sign-in form
 * calls that only after a successful sign-in, right before it redirects —
 * and never on a failed attempt — so it's the reliable "it worked" signal. */
export const SESSION_CHANGED_EVENT = "techstersol:session-changed";

/** If the redirect somehow never completes, give the form back rather than
 * leaving the user on a spinner forever. */
const SUCCESS_TIMEOUT_MS = 20_000;
/** How long the submit button must stay enabled, with no success, before an
 * attempt counts as failed (covers client-side validation errors too). */
const SETTLE_TICKS = 2;
const TICK_MS = 250;

/** Wraps the hosted auth form. On submit it hides the form and shows a
 * centered loader, so a slow sign-in can't be mistaken for a failed one and
 * clicked again. A failed attempt brings the form back (with the library's
 * own error toast); a successful one keeps the loader up until the redirect
 * to the dashboard takes over. The form stays mounted while hidden, so its
 * state and in-flight request are untouched. */
export function AuthFormGate({
  children,
  message = "Signing you in…",
}: {
  children: React.ReactNode;
  message?: string;
}) {
  const [phase, setPhase] = React.useState<"idle" | "submitting" | "success">(
    "idle",
  );
  const containerRef = React.useRef<HTMLDivElement>(null);
  const phaseRef = React.useRef(phase);
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Success: the session-changed event from the provider.
  React.useEffect(() => {
    function onSession() {
      if (phaseRef.current !== "idle") setPhase("success");
    }
    window.addEventListener(SESSION_CHANGED_EVENT, onSession);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, onSession);
  }, []);

  // Failure: while submitting, watch the submit button. A request in flight
  // keeps it disabled; if it stays enabled for a couple of ticks and no
  // success has arrived, the attempt failed — show the form again.
  React.useEffect(() => {
    if (phase !== "submitting") return;
    let enabledTicks = 0;
    const id = window.setInterval(() => {
      const button = containerRef.current?.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      if (button?.disabled) {
        enabledTicks = 0;
        return;
      }
      enabledTicks += 1;
      if (enabledTicks >= SETTLE_TICKS && phaseRef.current === "submitting") {
        setPhase("idle");
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "success") return;
    const id = window.setTimeout(() => setPhase("idle"), SUCCESS_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const busy = phase !== "idle";

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        hidden={busy}
        onSubmitCapture={() => setPhase("submitting")}
      >
        {children}
      </div>
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground"
        >
          <Spinner className="size-8 text-primary" />
          {message}
        </div>
      )}
    </div>
  );
}
