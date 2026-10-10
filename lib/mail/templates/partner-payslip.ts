import {
  emailBadge,
  emailButton,
  emailInfoRow,
  emailInfoTable,
  renderEmailShell,
} from "./shell";

export function renderPartnerPayslipIssuedEmail({
  payslipNumber,
  amount,
  periodLabel,
  verifyUrl,
  projectName,
  breakdown,
}: {
  payslipNumber: string;
  amount: string;
  periodLabel: string;
  verifyUrl: string;
  projectName?: string | null;
  breakdown?: {
    revenue?: string | null;
    workCost?: string | null;
    projectExpenses?: string | null;
    profit?: string | null;
    sharePercent?: number | null;
  } | null;
}) {
  const breakdownRows = breakdown
    ? [
        projectName ? emailInfoRow("Project", projectName) : "",
        breakdown.revenue
          ? emailInfoRow("Project revenue", breakdown.revenue)
          : "",
        breakdown.workCost ? emailInfoRow("Work cost", breakdown.workCost) : "",
        breakdown.projectExpenses
          ? emailInfoRow("Project expenses", breakdown.projectExpenses)
          : "",
        breakdown.profit ? emailInfoRow("Net profit", breakdown.profit) : "",
        breakdown.sharePercent != null
          ? emailInfoRow("Your share", `${breakdown.sharePercent}% of profit`)
          : "",
      ].join("")
    : "";

  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("Payslip Issued")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">Payslip ${payslipNumber}</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      A new profit-share payslip has been issued to you. The PDF is attached to this email.
    </p>
    ${emailInfoTable(breakdownRows + emailInfoRow("Amount paid", amount) + emailInfoRow("Period", periodLabel))}
    <div style="margin-top:28px;">${emailButton("Verify payslip", verifyUrl)}</div>
  `;
  return renderEmailShell({ title: `Payslip ${payslipNumber}`, bodyHtml });
}

/** Sent when an investment from a partner is recorded — the investment
 * slip PDF is attached. */
export function renderPartnerInvestmentRecordedEmail({
  slipNumber,
  amount,
  date,
  method,
  transactionId,
  projectName,
  portalUrl,
}: {
  slipNumber: string;
  amount: string;
  date: string;
  method: string;
  transactionId?: string | null;
  projectName?: string | null;
  portalUrl: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("Investment Recorded")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">Investment slip ${slipNumber}</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      Your investment has been recorded. The investment slip is attached to this email.
    </p>
    ${emailInfoTable(
      emailInfoRow("Amount", amount) +
        emailInfoRow("Date", date) +
        emailInfoRow("Funded by", method) +
        (projectName ? emailInfoRow("From project payout", projectName) : "") +
        (transactionId ? emailInfoRow("Transaction ID", transactionId) : ""),
    )}
    <div style="margin-top:28px;">${emailButton("View your investments", portalUrl)}</div>
  `;
  return renderEmailShell({ title: `Investment slip ${slipNumber}`, bodyHtml });
}
