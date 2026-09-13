import { INVOICE_STATUS_LABELS } from "@/lib/invoices/constants";
import { emailBadge, emailButton, emailInfoRow, emailInfoTable, emailStatusBadge, renderEmailShell } from "./shell";

export function renderInvoiceCreatedEmail({
  invoiceNumber,
  amount,
  dueDate,
  verifyUrl,
}: {
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  verifyUrl: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("New Invoice")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">Invoice ${invoiceNumber}</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      A new invoice has been issued to you. The PDF is attached to this email.
    </p>
    ${emailInfoTable(
      emailInfoRow("Status", emailStatusBadge(INVOICE_STATUS_LABELS.UNPAID, "amber"), { raw: true }) +
        emailInfoRow("Amount due", amount) +
        emailInfoRow("Due date", dueDate),
    )}
    <div style="margin-top:28px;">${emailButton("Verify invoice", verifyUrl)}</div>
  `;
  return renderEmailShell({ title: `Invoice ${invoiceNumber}`, bodyHtml });
}

export function renderInvoicePaidEmail({
  invoiceNumber,
  amount,
  paidOn,
  verifyUrl,
}: {
  invoiceNumber: string;
  amount: string;
  paidOn: string;
  verifyUrl: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("Payment Received")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">Invoice ${invoiceNumber} — Paid</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      Thanks — we've received your payment. The stamped, paid invoice PDF is attached.
    </p>
    ${emailInfoTable(
      emailInfoRow("Status", emailStatusBadge(INVOICE_STATUS_LABELS.PAID, "emerald"), { raw: true }) +
        emailInfoRow("Amount paid", amount) +
        emailInfoRow("Paid on", paidOn),
    )}
    <div style="margin-top:28px;">${emailButton("Verify invoice", verifyUrl)}</div>
  `;
  return renderEmailShell({ title: `Invoice ${invoiceNumber} — Paid`, bodyHtml });
}
