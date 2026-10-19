import { NextResponse } from "next/server";

import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";
import {
  formatSpendReference,
  renderPartnerSpendPdf,
} from "@/lib/partners/investment-pdf";
import {
  getPartnerSpendForPdf,
  toPartnerSpendPdfData,
} from "@/actions/partners/investment-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A spending slip — how part of a partner's investment was used. For the
 * partner it belongs to, and dashboard staff who can see partner
 * investments. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const spend = await getPartnerSpendForPdf(id);
  const allowed =
    !!spend &&
    (appUser.kind === "PARTNER"
      ? spend.partnerId === appUser.partner?.id
      : appUser.kind === "DASHBOARD_HANDLER" &&
        checkPermission(appUser, "partner-investments", "view"));
  if (!spend || !allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await renderPartnerSpendPdf(
    await toPartnerSpendPdfData(spend),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Spending-${formatSpendReference(spend.id)}.pdf"`,
    },
  });
}
