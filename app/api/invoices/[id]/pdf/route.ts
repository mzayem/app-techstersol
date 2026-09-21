import { NextResponse } from "next/server";

import { formatInvoiceFileNumber } from "@/lib/invoices/constants";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import {
  checkPermission,
  getActiveClientProfiles,
  getCurrentAppUser,
} from "@/lib/rbac/permissions";
import { getInvoiceForPdf, toInvoicePdfData } from "@/actions/invoices/queries";

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
  const invoice = await getInvoiceForPdf(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Not found (not forbidden) for an owned-data mismatch, so a guessed id
  // doesn't confirm another party's invoice exists.
  if (
    appUser.kind === "CLIENT" &&
    !getActiveClientProfiles(appUser).some((c) => c.id === invoice.clientId)
  ) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (appUser.kind === "TEAM") {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (
    appUser.kind === "DASHBOARD_HANDLER" &&
    !checkPermission(appUser, "invoices", "view")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const pdfData = await toInvoicePdfData(invoice);
  const buffer = await renderInvoicePdf(pdfData, origin);

  const filename = `Invoice-${formatInvoiceFileNumber(invoice.number)}-${invoice.status.toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
