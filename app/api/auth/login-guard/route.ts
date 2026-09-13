import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 30_000;

/** A stateless, short-lived proof that a precheck for this email happened
 * moments ago — required on the "failure" report so a caller can't spam
 * fake failures against an arbitrary victim's email without at least
 * round-tripping through a precheck each time. Not bulletproof against a
 * determined scripted attacker, but closes the trivial "curl the failure
 * endpoint directly" abuse path for this internal, small-user-count app. */
function signToken(email: string, issuedAt: number) {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET!;
  return createHmac("sha256", secret).update(`${email}:${issuedAt}`).digest("hex");
}

function mintToken(email: string) {
  const issuedAt = Date.now();
  return `${issuedAt}.${signToken(email, issuedAt)}`;
}

function verifyToken(email: string, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const [issuedAtRaw, signature] = token.split(".");
  const issuedAt = Number(issuedAtRaw);
  if (!issuedAtRaw || !signature || Number.isNaN(issuedAt)) return false;
  if (Date.now() - issuedAt > TOKEN_TTL_MS) return false;

  const expected = signToken(email, issuedAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phase = body?.phase;
  if (!email || typeof phase !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (phase === "precheck") {
    const result = await checkLoginAllowed(email);
    return NextResponse.json({ ...result, token: mintToken(email) });
  }

  if (phase === "success") {
    await recordLoginSuccess(email);
    return NextResponse.json({ ok: true });
  }

  if (phase === "failure") {
    if (!verifyToken(email, body?.token)) {
      return NextResponse.json({}, { status: 200 });
    }
    const outcome = await recordLoginFailure(email);
    return NextResponse.json(outcome);
  }

  return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
}
