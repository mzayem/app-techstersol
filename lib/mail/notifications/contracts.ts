import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail/transport";
import type { ContractStatus } from "@/lib/contracts/constants";
import type { UserKind } from "@/generated/prisma/client";
import {
  renderChatNotificationEmail,
  renderContractAssignedEmail,
  renderContractCreatedEmail,
  renderContractStatusEmail,
  renderProposalNotificationEmail,
} from "@/lib/mail/templates/contract";
import {
  getPartnerNotificationEmail,
  getStaffNotificationRecipients,
  getTeamMemberNotificationEmail,
} from "@/lib/mail/notifications/recipients";

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

/** One send for the whole staff list — first address in `to`, the rest in
 * `bcc` so staff don't see (or reply-all to) each other. */
async function sendToStaff(
  recipients: string[],
  mail: { subject: string; html: string },
) {
  if (recipients.length === 0) return;
  const [to, ...bcc] = recipients;
  await sendMail({ to, bcc: bcc.length ? bcc : undefined, ...mail });
}

/** A new PROPOSED project from the client portal, or from the partner
 * portal (pass `partnerName`) — goes to ADMIN_NOTIFY_EMAIL plus every staff
 * login that opted into project notifications. */
export function notifyProposalSubmitted({
  clientName,
  projectName,
  partnerName,
}: {
  clientName: string;
  projectName: string;
  partnerName?: string;
}) {
  return safeNotify("proposal notification", async () => {
    await sendToStaff(await getStaffNotificationRecipients("project"), {
      subject: `New project proposal: ${projectName}`,
      html: renderProposalNotificationEmail({
        clientName,
        projectName,
        partnerName,
        appUrl: appUrl(),
      }),
    });
  });
}

/** A dashboard user created a contract — emails the client (subject to the
 * contract/client email toggles, at their Client profile's email), plus the
 * partner and team member it was added for, if any. */
export async function notifyContractCreated(contractId: string) {
  await Promise.all([
    safeNotify("contract-created notification", async () => {
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
      if (
        !contract.statusEmailsEnabled ||
        !contract.client.emailNotificationsEnabled
      )
        return;
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
    }),
    notifyContractAssigned(contractId, { partner: true, teamMember: true }),
  ]);
}

/** Tells a contract's partner and/or team member they've been put on it.
 * Called on create (both) and on edit only for whichever of the two was
 * newly set or changed, so re-saving a contract never re-sends. Each goes
 * to their own profile's email (see recipients.ts). */
export function notifyContractAssigned(
  contractId: string,
  { partner, teamMember }: { partner: boolean; teamMember: boolean },
) {
  return safeNotify("contract-assigned notification", async () => {
    if (!partner && !teamMember) return;
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        projectName: true,
        status: true,
        deadline: true,
        partnerId: true,
        teamMemberId: true,
        client: { select: { name: true } },
      },
    });
    if (!contract) return;

    const [partnerEmail, teamEmail] = await Promise.all([
      partner && contract.partnerId
        ? getPartnerNotificationEmail(contract.partnerId)
        : null,
      teamMember && contract.teamMemberId
        ? getTeamMemberNotificationEmail(contract.teamMemberId)
        : null,
    ]);

    const send = (to: string, audience: "partner" | "team") =>
      sendMail({
        to,
        subject: `New project: ${contract.projectName}`,
        html: renderContractAssignedEmail({
          audience,
          projectName: contract.projectName,
          clientName: contract.client.name,
          status: contract.status as ContractStatus,
          deadline: formatDate(contract.deadline),
          appUrl: appUrl(),
        }),
      });

    await Promise.all([
      partnerEmail ? send(partnerEmail, "partner") : null,
      teamEmail ? send(teamEmail, "team") : null,
    ]);
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
    if (
      !contract.statusEmailsEnabled ||
      !contract.client.emailNotificationsEnabled
    )
      return;
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

/** A new chat message on a contract. A client's message goes to
 * ADMIN_NOTIFY_EMAIL, every staff login that opted into chat notifications,
 * and — on a partnered project — that project's partner. A message from
 * anyone else emails the client, but only while the contract's own "email
 * on new chat messages" toggle is on. */
export function notifyChatMessage({
  contractId,
  authorKind,
  authorLabel,
  message,
}: {
  contractId: string;
  authorKind: UserKind;
  authorLabel: string;
  message: string;
}) {
  return safeNotify("chat notification", async () => {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        projectName: true,
        chatNotificationsEnabled: true,
        partnerId: true,
        client: { select: { email: true } },
      },
    });
    if (!contract) return;

    const subject = `New message on ${contract.projectName}`;
    const render = (viewPath: string) =>
      renderChatNotificationEmail({
        projectName: contract.projectName,
        authorLabel,
        message,
        viewUrl: `${appUrl()}${viewPath}`,
      });

    if (authorKind !== "CLIENT") {
      if (!contract.chatNotificationsEnabled || !contract.client.email) return;
      await sendMail({
        to: contract.client.email,
        subject,
        html: render("/client-portal/contracts"),
      });
      return;
    }

    const partnerEmail = contract.partnerId
      ? await getPartnerNotificationEmail(contract.partnerId)
      : null;
    const staff = await getStaffNotificationRecipients("chat", {
      exclude: [partnerEmail],
    });

    await Promise.all([
      sendToStaff(staff, { subject, html: render("/projects/contracts") }),
      partnerEmail
        ? sendMail({
            to: partnerEmail,
            subject,
            html: render("/partner-portal/projects"),
          })
        : Promise.resolve(),
    ]);
  });
}
