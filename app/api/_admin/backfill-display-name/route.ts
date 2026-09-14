import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-off maintenance route: sets displayName (= name) on every existing
// AppUser's Neon Auth account. New/edited accounts already get this via
// actions/rbac/user-actions.ts — this just backfills accounts created
// before that existed. Safe to call more than once. Delete this route once
// it's been run.
export async function GET() {
  await requirePagePermission("users", "edit");

  const users = await prisma.appUser.findMany({
    select: { authUserId: true, name: true, email: true },
  });

  const results = [];
  for (const user of users) {
    const { error } = await auth.admin.updateUser({
      userId: user.authUserId,
      data: { displayName: user.name },
    });
    results.push({ email: user.email, ok: !error, error: error?.message });
  }

  return NextResponse.json({ count: users.length, results });
}
