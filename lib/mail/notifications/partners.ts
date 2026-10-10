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
} from "@/lib/mail/templates/partner-payslip";
import { renderPartnerInvestmentPdf } from "@/lib/partners/investment-pdf";
import {
  INVESTMENT_METHOD_LABELS,
  formatPartnerInvestmentNumber,
} from "@/lib/partners/investment-constants";
import {
  getPartnerInvestmentForPdf,
  toPartnerInvestmentPdfData,
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

/** Emails the partner their investment slip (PDF attached) when an
 * investment from them is recorded — same opt-out as payslips
 * (Partner.payslipEmailsEnabled). Errors are logged, not thrown. */
export async function notifyPartnerInvestmentRecorded(investmentId: string) {
  try {
    const investment = await getPartnerInvestmentForPdf(investmentId);
    if (
      !investment ||
      !investment.partner.email ||
      !investment.partner.payslipEmailsEnabled
    ) {
      return;
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
  } catch (err) {
    console.error("[mail] partner-investment notification failed:", err);
  }
}
