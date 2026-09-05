import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatInvoiceFileNumber } from "@/lib/invoices/constants";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { getInvoiceForPdf } from "@/actions/invoices/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const invoice = await getInvoiceForPdf(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
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
