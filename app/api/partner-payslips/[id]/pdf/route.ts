import { NextResponse } from "next/server";

import { getCurrentAppUser } from "@/lib/rbac/permissions";
import { formatPartnerPayslipNumber } from "@/lib/partners/constants";
import { renderPartnerPayslipPdf } from "@/lib/partners/payslip-pdf";
import {
  getPartnerPayslipForPdf,
  toPartnerPayslipPdfData,
} from "@/actions/partners/payslip-queries";

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
  const payslip = await getPartnerPayslipForPdf(id);
  if (!payslip) {
    return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  }

  if (appUser.kind === "PARTNER" && payslip.partnerId !== appUser.partner?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const buffer = await renderPartnerPayslipPdf(
    toPartnerPayslipPdfData(payslip),
    origin,
  );

  const filename = `Payslip-${formatPartnerPayslipNumber(payslip.number)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
