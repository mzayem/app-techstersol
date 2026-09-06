import { NextResponse } from "next/server";

import { getCurrentAppUser } from "@/lib/rbac/permissions";
import { formatPayslipNumber } from "@/lib/team/constants";
import { renderPayslipPdf } from "@/lib/team/payslip-pdf";
import { getPayslipForPdf } from "@/actions/team/payslip-queries";

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
  const payslip = await getPayslipForPdf(id);
  if (!payslip) {
    return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  }

  if (appUser.kind === "TEAM" && payslip.teamMemberId !== appUser.teamMember?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const buffer = await renderPayslipPdf(
    {
      id: payslip.id,
      number: payslip.number,
      periodStart: payslip.periodStart,
      periodEnd: payslip.periodEnd,
      issueDate: payslip.issueDate,
      amount: Number(payslip.amount),
      note: payslip.note,
      projectName: payslip.contract?.projectName ?? null,
      teamMember: {
        name: payslip.teamMember.name,
        phone: payslip.teamMember.phone,
        email: payslip.teamMember.email,
        country: payslip.teamMember.country,
        address: payslip.teamMember.address,
      },
    },
    origin,
  );

  const filename = `Payslip-${formatPayslipNumber(payslip.number)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
