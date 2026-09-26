"use server";

import { sendMail } from "@/lib/mail/transport";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { renderPayslipPdf } from "@/lib/team/payslip-pdf";
import { formatContractAmount } from "@/lib/contracts/constants";
import { formatInvoiceNumber } from "@/lib/invoices/constants";
import { formatPayslipNumber } from "@/lib/team/constants";
import { getInvoiceForPdf, toInvoicePdfData } from "@/actions/invoices/queries";
import {
  getPayslipForPdf,
  toPayslipPdfData,
} from "@/actions/team/payslip-queries";
import { renderPartnerPayslipPdf } from "@/lib/partners/payslip-pdf";
import { formatPartnerPayslipNumber } from "@/lib/partners/constants";
import {
  getPartnerPayslipForPdf,
  toPartnerPayslipPdfData,
} from "@/actions/partners/payslip-queries";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";
import { renderContractDetailsEmail } from "@/lib/mail/templates/contract";
import {
  renderInvoiceCreatedEmail,
  renderInvoicePaidEmail,
} from "@/lib/mail/templates/invoice";
import { renderPayslipIssuedEmail } from "@/lib/mail/templates/payslip";
import { renderPartnerPayslipIssuedEmail } from "@/lib/mail/templates/partner-payslip";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function requireValidEmail(to: string) {
  const trimmed = to.trim();
  if (!trimmed || !EMAIL_RE.test(trimmed)) {
    throw new Error("Enter a valid recipient email address");
  }
  return trimmed;
}

/** Manual "send email" buttons on a contract/invoice/payslip row — always
 * sends that record's own details (with a PDF attached for invoice/
 * payslip), never a free-text message. This is a human explicitly
 * choosing to (re)send the details right now, so unlike the automatic
 * notifiers in lib/mail/notifications/*, it ignores the notification
 * toggles entirely. */
export async function sendContractEmail(to: string, contractId: string) {
  const { appUser } = await requirePagePermission("contracts", "view");
  const recipient = requireValidEmail(to);

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      projectName: true,
      status: true,
      deadline: true,
      description: true,
      currency: true,
      amount: true,
      paymentType: true,
      milestones: { select: { amount: true } },
    },
  });
  if (!contract) throw new Error("Contract not found");

  const amount =
    contract.paymentType === "PROJECT"
      ? Number(contract.amount ?? 0)
      : contract.milestones.reduce((sum, m) => sum + Number(m.amount), 0);

  await sendMail({
    to: recipient,
    subject: contract.projectName,
    html: renderContractDetailsEmail({
      projectName: contract.projectName,
      status: contract.status,
      deadline: formatDate(contract.deadline),
      description: contract.description,
      amount:
        amount > 0 ? formatContractAmount(amount, contract.currency) : null,
    }),
  });

  await logActivity(appUser, {
    action: "sent-email",
    entityType: "contract",
    entityId: contractId,
    summary: `Emailed contract "${contract.projectName}" details to ${recipient}`,
    page: "contracts",
  });
}

export async function sendInvoiceEmail(to: string, invoiceId: string) {
  const { appUser } = await requirePagePermission("invoices", "view");
  const recipient = requireValidEmail(to);

  const invoice = await getInvoiceForPdf(invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  const pdfData = await toInvoicePdfData(invoice);
  const buffer = await renderInvoicePdf(pdfData, appUrl());

  const total = pdfData.items.reduce((sum, item) => sum + item.amount, 0);
  const balanceDue = total - pdfData.discount;

  // Reflect the invoice's real current status — a manually resent PAID
  // invoice should show "Paid", not always the "just created" template.
  const html =
    invoice.status === "PAID"
      ? renderInvoicePaidEmail({
          invoiceNumber: formatInvoiceNumber(invoice.number),
          amount: formatContractAmount(balanceDue, pdfData.currency),
          paidOn: invoice.paidOn
            ? formatDate(invoice.paidOn)
            : formatDate(new Date()),
          verifyUrl: `${appUrl()}/verify/${invoice.id}`,
        })
      : renderInvoiceCreatedEmail({
          invoiceNumber: formatInvoiceNumber(invoice.number),
          amount: formatContractAmount(balanceDue, pdfData.currency),
          dueDate: formatDate(invoice.dueDate),
          verifyUrl: `${appUrl()}/verify/${invoice.id}`,
        });

  await sendMail({
    to: recipient,
    subject: `Invoice ${formatInvoiceNumber(invoice.number)}`,
    html,
    attachments: [
      {
        filename: `Invoice-${formatInvoiceNumber(invoice.number)}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  });

  await logActivity(appUser, {
    action: "sent-email",
    entityType: "invoice",
    entityId: invoiceId,
    summary: `Emailed invoice ${formatInvoiceNumber(invoice.number)} to ${recipient}`,
    page: "invoices",
  });
}

export async function sendPayslipEmail(to: string, payslipId: string) {
  const { appUser } = await requirePagePermission("payslips", "view");
  const recipient = requireValidEmail(to);

  const payslip = await getPayslipForPdf(payslipId);
  if (!payslip) throw new Error("Payslip not found");
  const pdfData = toPayslipPdfData(payslip);
  const buffer = await renderPayslipPdf(pdfData, appUrl());

  await sendMail({
    to: recipient,
    subject: `Payslip ${formatPayslipNumber(payslip.number)}`,
    html: renderPayslipIssuedEmail({
      payslipNumber: formatPayslipNumber(payslip.number),
      amount: `${pdfData.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`,
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

  await logActivity(appUser, {
    action: "sent-email",
    entityType: "payslip",
    entityId: payslipId,
    summary: `Emailed payslip ${formatPayslipNumber(payslip.number)} to ${recipient}`,
    page: "payslips",
  });
}

export async function sendPartnerPayslipEmail(
  to: string,
  partnerPayslipId: string,
) {
  const { appUser } = await requirePagePermission("partner-payslips", "view");
  const recipient = requireValidEmail(to);

  const payslip = await getPartnerPayslipForPdf(partnerPayslipId);
  if (!payslip) throw new Error("Payslip not found");
  const pdfData = toPartnerPayslipPdfData(payslip);
  const buffer = await renderPartnerPayslipPdf(pdfData, appUrl());

  await sendMail({
    to: recipient,
    subject: `Payslip ${formatPartnerPayslipNumber(payslip.number)}`,
    html: renderPartnerPayslipIssuedEmail({
      payslipNumber: formatPartnerPayslipNumber(payslip.number),
      amount: `${pdfData.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`,
      periodLabel: `${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)}`,
      verifyUrl: `${appUrl()}/verify/partner-payslip/${payslip.id}`,
      projectName: pdfData.projectName,
      breakdown: pdfData.breakdown
        ? {
            revenue:
              pdfData.breakdown.revenueAmount != null
                ? `${pdfData.breakdown.revenueAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`
                : null,
            workCost:
              pdfData.breakdown.workCostAmount != null
                ? `${pdfData.breakdown.workCostAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`
                : null,
            projectExpenses: pdfData.breakdown.projectExpensesAmount
              ? `${pdfData.breakdown.projectExpensesAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`
              : null,
            profit:
              pdfData.breakdown.profitAmount != null
                ? `${pdfData.breakdown.profitAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`
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

  await logActivity(appUser, {
    action: "sent-email",
    entityType: "partner-payslip",
    entityId: partnerPayslipId,
    summary: `Emailed partner payslip ${formatPartnerPayslipNumber(payslip.number)} to ${recipient}`,
    page: "partner-payslips",
  });
}
