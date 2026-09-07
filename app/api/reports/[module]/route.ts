import { NextResponse } from "next/server";

import { getCurrentAppUser, checkPermission } from "@/lib/rbac/permissions";
import { REPORT_MODULES } from "@/lib/reports/modules";
import { renderReportExcel } from "@/lib/reports/excel";
import { renderReportPdf } from "@/lib/reports/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  const { module: moduleSlug } = await params;
  const moduleDef = REPORT_MODULES[moduleSlug];
  if (!moduleDef) {
    return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!checkPermission(appUser, moduleDef.pageKey, "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json(
      { error: "format must be 'xlsx' or 'pdf'" },
      { status: 400 },
    );
  }

  const searchParams: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== "format") searchParams[key] = value;
  }

  const spec = await moduleDef.fetch(searchParams);
  const buffer =
    format === "xlsx"
      ? await renderReportExcel(spec)
      : await renderReportPdf(spec);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${moduleDef.filename}-${dateStamp}.${format}`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
