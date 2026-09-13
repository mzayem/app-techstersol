import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail/transport";
import type { ContractStatus } from "@/lib/contracts/constants";
import {
  renderChatNotificationEmail,
  renderContractCreatedEmail,
  renderContractStatusEmail,
  renderProposalNotificationEmail,
} from "@/lib/mail/templates/contract";

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

/** Every notifier here swallows and logs its own errors — a mail outage
 * should never fail the underlying contract mutation that triggered it.
 * Callers still `await` the result (rather than firing-and-forgetting) so
 * the send genuinely completes before the server action returns, which
 * matters on serverless/edge runtimes that can suspend a function once
 * its response is sent. */
function safeNotify(label: string, fn: () => Promise<void>): Promise<void> {
  return fn().catch((err) => console.error(`[mail] ${label} failed:`, err));
}

export function notifyProposalSubmitted({
  clientName,
  projectName,
}: {
  clientName: string;
  projectName: string;
}) {
  return safeNotify("proposal notification", async () => {
    const to = process.env.ADMIN_NOTIFY_EMAIL;
    if (!to) return;
    await sendMail({
      to,
      subject: `New project proposal: ${projectName}`,
      html: renderProposalNotificationEmail({ clientName, projectName, appUrl: appUrl() }),
    });
  });
}

export function notifyContractCreated(contractId: string) {
  return safeNotify("contract-created notification", async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        projectName: true,
        status: true,
        deadline: true,
        statusEmailsEnabled: true,
        client: { select: { email: true, emailNotificationsEnabled: true } },
      },
    });
    if (!contract) return;
    if (!contract.statusEmailsEnabled || !contract.client.emailNotificationsEnabled) return;
    if (!contract.client.email) return;

    await sendMail({
      to: contract.client.email,
      subject: `New project: ${contract.projectName}`,
      html: renderContractCreatedEmail({
        projectName: contract.projectName,
        status: contract.status as ContractStatus,
        deadline: formatDate(contract.deadline),
      }),
    });
  });
}

export function notifyContractStatusChanged(contractId: string) {
  return safeNotify("contract-status notification", async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        projectName: true,
        status: true,
        statusEmailsEnabled: true,
        client: { select: { email: true, emailNotificationsEnabled: true } },
      },
    });
    if (!contract) return;
    if (!contract.statusEmailsEnabled || !contract.client.emailNotificationsEnabled) return;
    if (!contract.client.email) return;

    await sendMail({
      to: contract.client.email,
      subject: `${contract.projectName} — status update`,
      html: renderContractStatusEmail({
        projectName: contract.projectName,
        status: contract.status as ContractStatus,
      }),
    });
  });
}

export function notifyChatMessage({
  projectName,
  authorLabel,
  message,
  forAdmin,
  clientEmail,
}: {
  projectName: string;
  authorLabel: string;
  message: string;
  forAdmin: boolean;
  clientEmail: string | null;
}) {
  return safeNotify("chat notification", async () => {
    const to = forAdmin ? process.env.ADMIN_NOTIFY_EMAIL : clientEmail;
    if (!to) return;
    await sendMail({
      to,
      subject: `New message on ${projectName}`,
      html: renderChatNotificationEmail({
        projectName,
        authorLabel,
        message,
        appUrl: appUrl(),
        forAdmin,
      }),
    });
  });
}
