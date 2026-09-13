"use client";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();

type SignInEmail = typeof authClient.signIn.email;

async function postLoginGuard(
  body: Record<string, unknown>,
): Promise<{ allowed?: boolean; message?: string; token?: string }> {
  try {
    const res = await fetch("/api/auth/login-guard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    // Guard endpoint unreachable — fail open rather than locking everyone
    // out of sign-in because of an unrelated network hiccup.
    return { allowed: true };
  }
}

/** Wraps the shared authClient's email sign-in with our own brute-force
 * lockout, since Neon Auth's pre-built SignInForm calls
 * `authClient.signIn.email(...)` directly against its remote backend with
 * no onSuccess/onError hook to plug into otherwise. This runs once here,
 * before any component reads `authClient.signIn.email` off the shared
 * object, so SignInForm picks up the wrapped version automatically. */
const rawSignInEmail: SignInEmail = authClient.signIn.email.bind(authClient.signIn);

authClient.signIn.email = (async (...args: Parameters<SignInEmail>) => {
  const credentials = args[0] as { email?: unknown };
  const email =
    typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";

  if (!email) return rawSignInEmail(...args);

  const pre = await postLoginGuard({ phase: "precheck", email });
  if (pre.allowed === false) {
    throw new Error(pre.message ?? "Sign-in is currently unavailable for this account.");
  }

  try {
    const result = await rawSignInEmail(...args);
    void postLoginGuard({ phase: "success", email });
    return result;
  } catch (err) {
    const failure = await postLoginGuard({ phase: "failure", email, token: pre.token });
    if (failure.message) throw new Error(failure.message);
    throw err;
  }
}) as SignInEmail;
