import { NextResponse } from "next/server";

import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatInvoiceFileNumber } from "@/lib/invoices/constants";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { checkPermission, getActiveClientProfiles, getCurrentAppUser } from "@/lib/rbac/permissions";
import { getInvoiceForPdf } from "@/actions/invoices/queries";

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
  if (appUser.kind === "DASHBOARD_HANDLER" && !checkPermission(appUser, "invoices", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const buffer = await renderInvoicePdf(
    {
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paidOn: invoice.paidOn,
      transactionId: invoice.transactionId,
      currency: invoice.currency as PaymentCurrency,
      discount: Number(invoice.discount),
      client: {
        name: invoice.client.name,
        phone: invoice.client.phone,
        email: invoice.client.email,
        country: invoice.client.country,
      },
      bankAccount: {
        bankName: invoice.bankAccount.bankName,
        accountHolderName: invoice.bankAccount.accountHolderName,
        accountType: invoice.bankAccount.accountType,
        routingNumber: invoice.bankAccount.routingNumber,
        accountNumber: invoice.bankAccount.accountNumber,
        iban: invoice.bankAccount.iban,
        sortCode: invoice.bankAccount.sortCode,
        bsbCode: invoice.bankAccount.bsbCode,
        swift: invoice.bankAccount.swift,
      },
      items: invoice.items.map((item) => ({
        description: item.description,
        amount: Number(item.amount),
      })),
    },
    origin,
  );

  const filename = `Invoice-${formatInvoiceFileNumber(invoice.number)}-${invoice.status.toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
