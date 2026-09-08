import { NextResponse } from "next/server";

import { getCurrentAppUser, checkPermission } from "@/lib/rbac/permissions";
import { ANALYSIS_REPORTS, isAnalysisReportType } from "@/lib/reports/analysis/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!isAnalysisReportType(type)) {
    return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!checkPermission(appUser, "reports", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reportDef = ANALYSIS_REPORTS[type];
  const url = new URL(request.url);
  const searchParams: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    searchParams[key] = value;
  }

  const buffer = await reportDef.render(searchParams, appUser.name);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${reportDef.filename}-${dateStamp}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
