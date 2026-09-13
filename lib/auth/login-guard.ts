import { prisma } from "@/lib/prisma";

/** Minutes locked at each successive tier — index 0 is the lock applied
 * the first time 5 wrong attempts accumulate, index 1 the second time,
 * etc. A 4th violation after the last tier permanently blocks instead of
 * issuing a 4th timer. */
const LOCKOUT_TIERS_MINUTES = [5, 15, 60] as const;
const ATTEMPTS_PER_TIER = 5;

export type LoginGuardCheck = { allowed: boolean; message?: string };
export type LoginGuardOutcome = { message?: string };

/** Called before attempting a real sign-in. Never reveals whether the
 * email belongs to an account — an unknown email is always "allowed",
 * exactly like Neon Auth's own "invalid credentials" error already treats
 * unknown and wrong-password cases identically. */
export async function checkLoginAllowed(email: string): Promise<LoginGuardCheck> {
  const appUser = await prisma.appUser.findUnique({
    where: { email },
    select: { status: true, lockedUntil: true },
  });
  if (!appUser) return { allowed: true };

  if (appUser.status !== "ACTIVE") {
    return {
      allowed: false,
      message: "This account has been blocked. Please contact your administrator.",
    };
  }

  if (appUser.lockedUntil && appUser.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.max(
      1,
      Math.ceil((appUser.lockedUntil.getTime() - Date.now()) / 60_000),
    );
    return {
      allowed: false,
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  return { allowed: true };
}

/** One correct sign-in wipes the slate clean, regardless of how far into
 * the lockout tiers the account had gotten. */
export async function recordLoginSuccess(email: string): Promise<void> {
  await prisma.appUser.updateMany({
    where: { email },
    data: { failedLoginAttempts: 0, lockoutStage: 0, lockedUntil: null },
  });
}

/** Increments the failure count and, every 5th failure, escalates to the
 * next lockout tier (or a permanent block once every tier is used).
 * Returns a user-facing message only when a new lockout/block just kicked
 * in — an ordinary sub-5 failure returns nothing extra to show. */
export async function recordLoginFailure(email: string): Promise<LoginGuardOutcome> {
  const appUser = await prisma.appUser.findUnique({
    where: { email },
    select: { id: true, failedLoginAttempts: true, lockoutStage: true },
  });
  if (!appUser) return {};

  const attempts = appUser.failedLoginAttempts + 1;
  if (attempts < ATTEMPTS_PER_TIER) {
    await prisma.appUser.update({
      where: { id: appUser.id },
      data: { failedLoginAttempts: attempts },
    });
    return {};
  }

  if (appUser.lockoutStage < LOCKOUT_TIERS_MINUTES.length) {
    const minutes = LOCKOUT_TIERS_MINUTES[appUser.lockoutStage];
    await prisma.appUser.update({
      where: { id: appUser.id },
      data: {
        failedLoginAttempts: 0,
        lockoutStage: appUser.lockoutStage + 1,
        lockedUntil: new Date(Date.now() + minutes * 60_000),
      },
    });
    return { message: `Too many failed attempts. Account locked for ${minutes} minutes.` };
  }

  await prisma.appUser.update({
    where: { id: appUser.id },
    data: { status: "BLOCKED", failedLoginAttempts: 0, lockedUntil: null },
  });
  return {
    message: "Too many failed attempts. This account has been blocked. Please contact your administrator.",
  };
}
