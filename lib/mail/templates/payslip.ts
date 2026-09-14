import {
  emailBadge,
  emailButton,
  emailInfoRow,
  emailInfoTable,
  renderEmailShell,
} from "./shell";

export function renderPayslipIssuedEmail({
  payslipNumber,
  amount,
  periodLabel,
  verifyUrl,
}: {
  payslipNumber: string;
  amount: string;
  periodLabel: string;
  verifyUrl: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("Payslip Issued")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">Payslip ${payslipNumber}</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      A new payslip has been issued to you. The PDF is attached to this email.
    </p>
    ${emailInfoTable(emailInfoRow("Amount", amount) + emailInfoRow("Period", periodLabel))}
    <div style="margin-top:28px;">${emailButton("Verify payslip", verifyUrl)}</div>
  `;
  return renderEmailShell({ title: `Payslip ${payslipNumber}`, bodyHtml });
}
