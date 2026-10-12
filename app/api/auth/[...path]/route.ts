import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NEON_AUTH_COOKIE_PREFIX } from "@neondatabase/auth/server";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  clientIp,
  consumeRateLimit,
  tooManyAttemptsResponse,
} from "@/lib/auth/rate-limit";

const WINDOW_SECONDS = 15 * 60;

/** Attempts allowed per 15 minutes on endpoints worth brute-forcing.
 * Neon Auth runs Better Auth on a hosted backend whose own rate limiter
 * can't be configured from here (createNeonAuth only takes baseUrl and
 * cookie settings), so this proxy route enforces it. Per-IP stops one
 * machine hammering; per-email stops a slow guess spread across IPs. */
const LIMITS: {
  match: (path: string) => boolean;
  scope: string;
  perIp: number;
  perEmail: number;
}[] = [
  {
    // Password and email-OTP sign-in.
    match: (path) =>
      path.startsWith("sign-in/") ||
      path === "email-otp/check-verification-otp",
    scope: "sign-in",
    perIp: 10,
    perEmail: 5,
  },
  {
    // Sending reset links/codes and using them.
    match: (path) =>
      path === "forget-password" ||
      path === "request-password-reset" ||
      path === "reset-password" ||
      path.startsWith("email-otp/"),
    scope: "reset",
    perIp: 5,
    perEmail: 3,
  },
  {
    match: (path) => path.startsWith("sign-up/"),
    scope: "sign-up",
    perIp: 5,
    perEmail: 3,
  },
];

async function readEmail(request: Request) {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : null;
  } catch {
    return null;
  }
}

const handlers = auth.handler();

/** Defense-in-depth for social sign-in: Neon Auth proxies OAuth callbacks to
 * a hosted backend we don't control, and it auto-provisions a new upstream
 * account the moment an unrecognized email completes a Google login — there
 * is no hook to intercept that before it happens. So instead we check right
 * after the callback whether the session it just created maps to an
 * AppUser; if not, this is someone nobody has added via the Users page, so
 * we strip the session cookies the callback just set and bounce them back
 * to sign-in with an error instead of ever reaching the app. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const response = await handlers.GET(request, ctx);

  if (path[0] !== "callback") return response;

  const { data } = await auth.getSession();
  if (!data?.user) return response;

  const appUser = await prisma.appUser.findUnique({
    where: { authUserId: data.user.id },
  });
  if (appUser) return response;

  const redirectUrl = new URL("/auth/sign-in?error=unregistered", request.url);
  const denyResponse = NextResponse.redirect(redirectUrl);
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      denyResponse.cookies.delete(cookie.name);
    }
  }
  return denyResponse;
}

/** Defense-in-depth: the primary lock on sign-up is /auth/[path]/page.tsx
 * redirecting away from the hosted form, but that only stops someone using
 * the UI — this rejects a raw POST to the underlying endpoint too, once an
 * admin already exists. The path check follows Better Auth's REST
 * convention (confirmed against this SDK's own route table: "sign-up/email"),
 * not an officially documented hook, so this may need adjusting if a future
 * SDK version changes that path. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const joined = path.join("/");

  const limit = LIMITS.find((l) => l.match(joined));
  const email = limit ? await readEmail(request) : null;
  if (limit) {
    const byIp = await consumeRateLimit(
      `ip:${limit.scope}:${clientIp(request)}`,
      limit.perIp,
      WINDOW_SECONDS,
    );
    if (!byIp.allowed) return tooManyAttemptsResponse(byIp.retryAfterSeconds);
    if (email) {
      const byEmail = await consumeRateLimit(
        `email:${limit.scope}:${email}`,
        limit.perEmail,
        WINDOW_SECONDS,
      );
      if (!byEmail.allowed) {
        return tooManyAttemptsResponse(byEmail.retryAfterSeconds);
      }
    }
  }

  if (joined === "sign-up/email") {
    const existingCount = await prisma.appUser.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Sign-up is disabled" },
        { status: 403 },
      );
    }
  }

  const response = await handlers.POST(request, ctx);

  // A successful sign-in clears that email's count, so the real owner isn't
  // left half-way to a lockout by their own earlier typos.
  if (limit?.scope === "sign-in" && email && response.ok) {
    await prisma.authRateLimit
      .deleteMany({ where: { key: `email:sign-in:${email}` } })
      .catch(() => {});
  }
  return response;
}
