import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

const handlers = auth.handler();

export const GET = handlers.GET;

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

  if (path.join("/") === "sign-up/email") {
    const existingCount = await prisma.appUser.count();
    if (existingCount > 0) {
      return NextResponse.json({ error: "Sign-up is disabled" }, { status: 403 });
    }
  }

  return handlers.POST(request, ctx);
}
