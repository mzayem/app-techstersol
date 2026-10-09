import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
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
  // A partner only sees invoices that bill one of their own contracts.
  if (appUser.kind === "PARTNER") {
    const partnerId = appUser.partner?.id;
    const owns =
      !!partnerId &&
      (await prisma.invoiceContract.count({
        where: { invoiceId: invoice.id, contract: { partnerId } },
      })) > 0;
    if (!owns) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
  }
  if (
    appUser.kind === "DASHBOARD_HANDLER" &&
    !checkPermission(appUser, "invoices", "view")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  // The tax copy (payment settlement: fees/taxes deducted and the amount
  // actually received) is for the company and its partners — partners see
  // it for transparency on what the company actually received. Never for
  // the client, whose copy stays the plain invoice they paid.
  const taxCopy =
    url.searchParams.get("copy") === "tax" &&
    (appUser.kind === "DASHBOARD_HANDLER" || appUser.kind === "PARTNER") &&
    invoice.status === "PAID";
  const pdfData = await toInvoicePdfData(invoice, { taxCopy });
  const buffer = await renderInvoicePdf(pdfData, origin);

  const filename = `Invoice-${formatInvoiceFileNumber(invoice.number)}-${taxCopy ? "tax-copy" : invoice.status.toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
