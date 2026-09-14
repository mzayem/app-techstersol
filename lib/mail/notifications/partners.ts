import { sendMail } from "@/lib/mail/transport";
import { renderPartnerPayslipPdf } from "@/lib/partners/payslip-pdf";
import { formatPartnerPayslipNumber } from "@/lib/partners/constants";
import { getPartnerPayslipForPdf, toPartnerPayslipPdfData } from "@/actions/partners/payslip-queries";
import { renderPartnerPayslipIssuedEmail } from "@/lib/mail/templates/partner-payslip";

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
    if (!payslip || !payslip.partner.email || !payslip.partner.payslipEmailsEnabled) {
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
