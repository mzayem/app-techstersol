import { NextResponse } from "next/server";

import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";
import { formatPartnerInvestmentNumber } from "@/lib/partners/investment-constants";
import { renderPartnerInvestmentPdf } from "@/lib/partners/investment-pdf";
import {
  getPartnerInvestmentForPdf,
  toPartnerInvestmentPdfData,
} from "@/actions/partners/investment-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const investment = await getPartnerInvestmentForPdf(id);
  if (!investment) {
    return NextResponse.json(
      { error: "Investment not found" },
      { status: 404 },
    );
  }

  // Only the partner it belongs to, or dashboard staff allowed to see
  // partner investments — never client or team logins.
  const allowed =
    appUser.kind === "PARTNER"
      ? investment.partnerId === appUser.partner?.id
      : appUser.kind === "DASHBOARD_HANDLER" &&
        checkPermission(appUser, "partner-investments", "view");
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await renderPartnerInvestmentPdf(
    toPartnerInvestmentPdfData(investment),
  );

  const filename = `Investment-${formatPartnerInvestmentNumber(investment.number)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
