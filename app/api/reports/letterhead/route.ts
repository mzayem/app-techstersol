import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { getCurrentAppUser, checkPermission } from "@/lib/rbac/permissions";
import { renderLetterheadPdf } from "@/lib/reports/letterhead/layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LetterheadRequestBody = {
  label?: string;
  date?: string;
  bodyHtml?: string;
  lineHeight?: number;
  signOff?: {
    mode?: "blank" | "filled";
    name?: string;
    role?: string;
    includeSignature?: boolean;
    /** Only meaningful alongside `includeSignature: true` — re-verified
     * against the signed-in user below, never trusted as-is. The client
     * only ever holds this in memory, from the same password-confirm step
     * that unlocked the toggle. */
    password?: string;
  };
};

export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!checkPermission(appUser, "reports", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as LetterheadRequestBody;
  const label = body.label?.trim();
  const date = body.date?.trim();
  const bodyHtml = body.bodyHtml ?? "";
  if (!label || !date) {
    return NextResponse.json({ error: "Label and date are required" }, { status: 400 });
  }

  const signOffInput = body.signOff ?? {};
  const mode = signOffInput.mode === "blank" ? "blank" : "filled";
  const includeSignature = signOffInput.includeSignature === true;
  const lineHeight =
    typeof body.lineHeight === "number" && body.lineHeight >= 1 && body.lineHeight <= 3
      ? body.lineHeight
      : undefined;

  if (includeSignature) {
    // The toggle is only a client-side convenience — this request is the
    // one that actually matters, so the password is re-checked here every
    // time, regardless of what the client claims about a prior check.
    const { error } = await auth.signIn.email({
      email: appUser.email,
      password: signOffInput.password ?? "",
    });
    if (error) {
      return NextResponse.json(
        { error: "Incorrect password — signature and stamp were not added" },
        { status: 403 },
      );
    }
  }

  const buffer = await renderLetterheadPdf({
    label,
    date,
    bodyHtml,
    lineHeight,
    signOff: {
      mode,
      name: signOffInput.name?.trim() || "Muhammad Zayem",
      role: signOffInput.role?.trim() || "Owner / Software Developer",
      includeSignature,
    },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dateStamp}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
