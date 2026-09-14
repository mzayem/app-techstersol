import { sendMail } from "@/lib/mail/transport";
import { renderPayslipPdf } from "@/lib/team/payslip-pdf";
import { formatPayslipNumber } from "@/lib/team/constants";
import {
  getPayslipForPdf,
  toPayslipPdfData,
} from "@/actions/team/payslip-queries";
import { renderPayslipIssuedEmail } from "@/lib/mail/templates/payslip";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL!;
}

// Payslips have no currency field — team pay is always tracked in PKR
// (same convention as the payslip PDF itself, lib/team/payslip-pdf.tsx).
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

export async function notifyPayslipIssued(payslipId: string) {
  try {
    const payslip = await getPayslipForPdf(payslipId);
    if (
      !payslip ||
      !payslip.teamMember.email ||
      !payslip.teamMember.payslipEmailsEnabled
    ) {
      return;
    }

    const pdfData = toPayslipPdfData(payslip);
    const buffer = await renderPayslipPdf(pdfData, appUrl());

    await sendMail({
      to: payslip.teamMember.email,
      subject: `Payslip ${formatPayslipNumber(payslip.number)}`,
      html: renderPayslipIssuedEmail({
        payslipNumber: formatPayslipNumber(payslip.number),
        amount: formatPkr(pdfData.amount),
        periodLabel: `${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)}`,
        verifyUrl: `${appUrl()}/verify/payslip/${payslip.id}`,
      }),
      attachments: [
        {
          filename: `Payslip-${formatPayslipNumber(payslip.number)}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (err) {
    console.error("[mail] payslip-issued notification failed:", err);
  }
}
