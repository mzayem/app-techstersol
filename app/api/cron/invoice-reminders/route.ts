import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { sendDueInvoiceReminders } from "@/lib/invoices/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    header.length === expected.length &&
    timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  );
}

/** Daily overdue-invoice reminder run. Excluded from the auth proxy (the
 * scheduler has no session), so it's gated on CRON_SECRET instead — Vercel
 * Cron sends it automatically as `Authorization: Bearer <CRON_SECRET>`;
 * any other scheduler must send the same header. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendDueInvoiceReminders();
  return NextResponse.json(result);
}
