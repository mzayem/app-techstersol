import { sendMail } from "@/lib/mail/transport";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { formatContractAmount } from "@/lib/contracts/constants";
import { formatInvoiceNumber } from "@/lib/invoices/constants";
import { getInvoiceForPdf, toInvoicePdfData } from "@/actions/invoices/queries";
import {
  renderInvoiceCreatedEmail,
  renderInvoicePaidEmail,
} from "@/lib/mail/templates/invoice";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL!;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function buildInvoicePdfAttachment(invoiceId: string) {
  const invoice = await getInvoiceForPdf(invoiceId);
  if (!invoice) return null;
  const pdfData = await toInvoicePdfData(invoice);
  const buffer = await renderInvoicePdf(pdfData, appUrl());
  return {
    invoice,
    pdfData,
    attachment: {
      filename: `Invoice-${formatInvoiceNumber(invoice.number)}.pdf`,
      content: buffer,
      contentType: "application/pdf",
    },
  };
}

/** No toggle gates this one — invoice emails always go out on create/paid,
 * unlike contract-status emails which respect the client/project
 * notification switches. Errors are logged, not thrown, same as every
 * other notifier here. */
export async function notifyInvoiceCreated(invoiceId: string) {
  try {
    const built = await buildInvoicePdfAttachment(invoiceId);
    if (!built || !built.invoice.client.email) return;
    const { invoice, pdfData, attachment } = built;

    const total = pdfData.items.reduce((sum, item) => sum + item.amount, 0);
    const balanceDue = total - pdfData.discount;

    await sendMail({
      to: invoice.client.email,
      subject: `Invoice ${formatInvoiceNumber(invoice.number)}`,
      html: renderInvoiceCreatedEmail({
        invoiceNumber: formatInvoiceNumber(invoice.number),
        amount: formatContractAmount(balanceDue, pdfData.currency),
        dueDate: formatDate(invoice.dueDate),
        verifyUrl: `${appUrl()}/verify/${invoice.id}`,
      }),
      attachments: [attachment],
    });
  } catch (err) {
    console.error("[mail] invoice-created notification failed:", err);
  }
}

export async function notifyInvoicePaid(invoiceId: string) {
  try {
    const built = await buildInvoicePdfAttachment(invoiceId);
    if (!built || !built.invoice.client.email) return;
    const { invoice, pdfData, attachment } = built;

    const total = pdfData.items.reduce((sum, item) => sum + item.amount, 0);
    const balanceDue = total - pdfData.discount;

    await sendMail({
      to: invoice.client.email,
      subject: `Invoice ${formatInvoiceNumber(invoice.number)} — Paid`,
      html: renderInvoicePaidEmail({
        invoiceNumber: formatInvoiceNumber(invoice.number),
        amount: formatContractAmount(balanceDue, pdfData.currency),
        paidOn: invoice.paidOn
          ? formatDate(invoice.paidOn)
          : formatDate(new Date()),
        verifyUrl: `${appUrl()}/verify/${invoice.id}`,
      }),
      attachments: [attachment],
    });
  } catch (err) {
    console.error("[mail] invoice-paid notification failed:", err);
  }
}
