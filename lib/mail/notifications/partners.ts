import { sendMail } from "@/lib/mail/transport";
import { renderPartnerPayslipPdf } from "@/lib/partners/payslip-pdf";
import { formatPartnerPayslipNumber } from "@/lib/partners/constants";
import {
  getPartnerPayslipForPdf,
  toPartnerPayslipPdfData,
} from "@/actions/partners/payslip-queries";
import {
  renderPartnerInvestmentRecordedEmail,
  renderPartnerPayslipIssuedEmail,
  renderPartnerSpendRecordedEmail,
} from "@/lib/mail/templates/partner-payslip";
import {
  formatSpendReference,
  renderPartnerInvestmentPdf,
  renderPartnerSpendPdf,
} from "@/lib/partners/investment-pdf";
import {
  INVESTMENT_METHOD_LABELS,
  formatPartnerInvestmentNumber,
} from "@/lib/partners/investment-constants";
import {
  getPartnerInvestmentForPdf,
  getPartnerSpendForPdf,
  toPartnerInvestmentPdfData,
  toPartnerSpendPdfData,
} from "@/actions/partners/investment-queries";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL!;
}

// Partner payslips have no currency field — partner share is always
// tracked in PKR (same convention as team payslips).
function formatPkr(amount: number) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function notifyPartnerPayslipIssued(payslipId: string) {
  try {
    const payslip = await getPartnerPayslipForPdf(payslipId);
    if (
      !payslip ||
      !payslip.partner.email ||
      !payslip.partner.payslipEmailsEnabled
    ) {
      return;
    }

    const pdfData = toPartnerPayslipPdfData(payslip);
    const buffer = await renderPartnerPayslipPdf(pdfData, appUrl());

    await sendMail({
      to: payslip.partner.email,
      subject: `Payslip ${formatPartnerPayslipNumber(payslip.number)}`,
      html: renderPartnerPayslipIssuedEmail({
        payslipNumber: formatPartnerPayslipNumber(payslip.number),
        amount: formatPkr(pdfData.amount),
        periodLabel: `${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)}`,
        verifyUrl: `${appUrl()}/verify/partner-payslip/${payslip.id}`,
        projectName: pdfData.projectName,
        breakdown: pdfData.breakdown
          ? {
              revenue:
                pdfData.breakdown.revenueAmount != null
                  ? formatPkr(pdfData.breakdown.revenueAmount)
                  : null,
              workCost:
                pdfData.breakdown.workCostAmount != null
                  ? formatPkr(pdfData.breakdown.workCostAmount)
                  : null,
              projectExpenses: pdfData.breakdown.projectExpensesAmount
                ? formatPkr(pdfData.breakdown.projectExpensesAmount)
                : null,
              profit:
                pdfData.breakdown.profitAmount != null
                  ? formatPkr(pdfData.breakdown.profitAmount)
                  : null,
              sharePercent: pdfData.breakdown.sharePercentageUsed,
            }
          : null,
      }),
      attachments: [
        {
          filename: `Payslip-${formatPartnerPayslipNumber(payslip.number)}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (err) {
    console.error("[mail] partner-payslip-issued notification failed:", err);
  }
}

export type SlipEmailResult =
  | { sent: true; to: string }
  | { sent: false; reason: "not-found" | "no-email" | "opted-out" };

/** Emails the partner their investment slip (PDF attached). Automatic
 * sends (respectOptOut) honour the partner's "Payslip & investment slip
 * emails" switch; the manual "Send email" button doesn't. Throws if the
 * mail itself fails, so the manual button can report it. */
export async function sendPartnerInvestmentSlipEmail(
  investmentId: string,
  { respectOptOut }: { respectOptOut: boolean },
): Promise<SlipEmailResult> {
  const investment = await getPartnerInvestmentForPdf(investmentId);
  if (!investment) return { sent: false, reason: "not-found" };
  if (!investment.partner.email) return { sent: false, reason: "no-email" };
  if (respectOptOut && !investment.partner.payslipEmailsEnabled) {
    return { sent: false, reason: "opted-out" };
  }

  const pdfData = toPartnerInvestmentPdfData(investment);
  const buffer = await renderPartnerInvestmentPdf(pdfData);
  const slipNumber = formatPartnerInvestmentNumber(investment.number);

  await sendMail({
    to: investment.partner.email,
    subject: `Investment slip ${slipNumber}`,
    html: renderPartnerInvestmentRecordedEmail({
      slipNumber,
      amount: formatPkr(pdfData.amount),
      date: formatDate(investment.date),
      method: INVESTMENT_METHOD_LABELS[investment.method],
      transactionId: investment.transactionId,
      projectName: pdfData.projectName,
      portalUrl: `${appUrl()}/partner-portal/investments`,
    }),
    attachments: [
      {
        filename: `Investment-${slipNumber}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  });
  return { sent: true, to: investment.partner.email };
}

/** Automatic send when an investment is recorded — never fails the save. */
export async function notifyPartnerInvestmentRecorded(investmentId: string) {
  try {
    await sendPartnerInvestmentSlipEmail(investmentId, { respectOptOut: true });
  } catch (err) {
    console.error("[mail] partner-investment notification failed:", err);
  }
}

/** Emails the partner a spending slip (PDF attached) — what part of their
 * investment was spent on, any company share, and the balance left. Same
 * opt-out rules as sendPartnerInvestmentSlipEmail. */
export async function sendPartnerSpendSlipEmail(
  spendId: string,
  { respectOptOut }: { respectOptOut: boolean },
): Promise<SlipEmailResult> {
  const spend = await getPartnerSpendForPdf(spendId);
  if (!spend) return { sent: false, reason: "not-found" };
  if (!spend.partner.email) return { sent: false, reason: "no-email" };
  if (respectOptOut && !spend.partner.payslipEmailsEnabled) {
    return { sent: false, reason: "opted-out" };
  }

  const pdfData = await toPartnerSpendPdfData(spend);
  const buffer = await renderPartnerSpendPdf(pdfData);
  const reference = formatSpendReference(spend.id);

  await sendMail({
    to: spend.partner.email,
    subject: `Spending slip ${reference} — ${spend.category}`,
    html: renderPartnerSpendRecordedEmail({
      reference,
      category: spend.category,
      date: formatDate(spend.date),
      partnerAmount: formatPkr(pdfData.partnerAmount),
      companyShare:
        pdfData.companyShare > 0 ? formatPkr(pdfData.companyShare) : null,
      balanceAfter: formatPkr(pdfData.balanceAfter),
      note: spend.note,
      portalUrl: `${appUrl()}/partner-portal/investments`,
    }),
    attachments: [
      {
        filename: `Spending-${reference}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  });
  return { sent: true, to: spend.partner.email };
}

/** Automatic send when spending is logged — never fails the save. */
export async function notifyPartnerSpendRecorded(spendId: string) {
  try {
    await sendPartnerSpendSlipEmail(spendId, { respectOptOut: true });
  } catch (err) {
    console.error("[mail] partner-spend notification failed:", err);
  }
}
