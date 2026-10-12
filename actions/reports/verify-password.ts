"use server";

import { auth } from "@/lib/auth/server";
import { getCurrentAppUser } from "@/lib/rbac/permissions";
import { consumeRateLimit } from "@/lib/auth/rate-limit";

/** Re-confirms the *currently signed-in* user's password before a
 * sensitive one-off action (embedding the real signature/stamp into a
 * generated letter) — gates the UI toggle, not a full re-auth flow. Neon
 * Auth (better-auth under the hood) has no dedicated "verify only"
 * endpoint, so this repeats the same `signIn.email` call the sign-in form
 * itself makes; for an already-signed-in user that's a harmless session
 * refresh, not a new login, and a wrong password just returns an error
 * without touching anything. */
export async function verifyCurrentPassword(
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return { ok: false, error: "Not signed in" };
  if (!password) return { ok: false, error: "Password is required" };

  // Same 15-minute cap as the sign-in form, per signed-in user.
  const limit = await consumeRateLimit(
    `verify:${appUser.authUserId}`,
    5,
    15 * 60,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many attempts. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const { error } = await auth.signIn.email({ email: appUser.email, password });
  return { ok: !error, error: error?.message };
}
