import {
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from "@/lib/contracts/constants";
import {
  emailBadge,
  emailButton,
  emailInfoRow,
  emailInfoTable,
  emailStatusBadge,
  escapeHtml,
  renderEmailShell,
  type StatusTone,
} from "./shell";

/** Mirrors `StatusPill`'s tone-per-status in
 * `components/contracts/contract-table.tsx` — keep these two in sync if
 * that mapping ever changes. */
const CONTRACT_STATUS_TONE: Record<ContractStatus, StatusTone> = {
  PROPOSED: "neutral",
  UPFRONT_PAYMENT: "violet",
  ACTIVE: "emerald",
  PENDING_PAYMENT: "amber",
  PARTIALLY_PAID: "orange",
  COMPLETED: "sky",
  PAUSED: "neutral",
  CANCELLED: "red",
};

function contractStatusBadge(status: ContractStatus) {
  return emailStatusBadge(
    CONTRACT_STATUS_LABELS[status],
    CONTRACT_STATUS_TONE[status],
  );
}

export function renderProposalNotificationEmail({
  clientName,
  projectName,
  appUrl,
}: {
  clientName: string;
  projectName: string;
  appUrl: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("New Proposal")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">New project proposal</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      <strong class="em-heading" style="color:#18181b;font-weight:600;">${escapeHtml(clientName)}</strong> just submitted a new project request from their client portal.
    </p>
    ${emailInfoTable(emailInfoRow("Project", projectName) + emailInfoRow("Submitted by", clientName))}
    <div style="margin-top:28px;">${emailButton("Review in dashboard", `${appUrl}/projects/contracts`)}</div>
  `;
  return renderEmailShell({ title: "New project proposal", bodyHtml });
}

export function renderContractCreatedEmail({
  projectName,
  status,
  deadline,
}: {
  projectName: string;
  status: ContractStatus;
  deadline: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("New Project")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">A new project has been created for you</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      We've set up a new project on your account. Here are the details:
    </p>
    ${emailInfoTable(
      emailInfoRow("Project", projectName) +
        emailInfoRow("Status", contractStatusBadge(status), { raw: true }) +
        emailInfoRow("Deadline", deadline),
    )}
  `;
  return renderEmailShell({ title: "New project created", bodyHtml });
}

export function renderContractDetailsEmail({
  projectName,
  status,
  deadline,
  description,
  amount,
}: {
  projectName: string;
  status: ContractStatus;
  deadline: string;
  description: string | null;
  amount: string | null;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("Project Details")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">${escapeHtml(projectName)}</h1>
    ${
      description
        ? `<p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">${escapeHtml(description)}</p>`
        : ""
    }
    ${emailInfoTable(
      emailInfoRow("Status", contractStatusBadge(status), { raw: true }) +
        emailInfoRow("Deadline", deadline) +
        (amount ? emailInfoRow("Amount", amount) : ""),
    )}
  `;
  return renderEmailShell({ title: projectName, bodyHtml });
}

export function renderContractStatusEmail({
  projectName,
  status,
}: {
  projectName: string;
  status: ContractStatus;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("Status Update")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">Your project status has changed</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      Here's the latest status for your project with Techstersol.
    </p>
    ${emailInfoTable(emailInfoRow("Project", projectName) + emailInfoRow("New status", contractStatusBadge(status), { raw: true }))}
  `;
  return renderEmailShell({ title: "Project status update", bodyHtml });
}

export function renderChatNotificationEmail({
  projectName,
  authorLabel,
  message,
  appUrl,
  forAdmin,
}: {
  projectName: string;
  authorLabel: string;
  message: string;
  appUrl: string;
  forAdmin: boolean;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("New Message")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">New note on ${escapeHtml(projectName)}</h1>
    <p class="em-muted" style="margin:0 0 20px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      <strong class="em-heading" style="color:#18181b;font-weight:600;">${escapeHtml(authorLabel)}</strong> left a message:
    </p>
    <div class="em-panel em-heading" style="background:rgba(120,120,130,0.08);border:1px solid rgba(120,120,130,0.2);border-radius:12px;padding:16px 20px;font-size:14px;line-height:1.7;color:#18181b;white-space:pre-wrap;">${escapeHtml(message)}</div>
    <div style="margin-top:28px;">${emailButton(
      "View conversation",
      forAdmin
        ? `${appUrl}/projects/contracts`
        : `${appUrl}/client-portal/contracts`,
    )}</div>
  `;
  return renderEmailShell({
    title: `New message on ${escapeHtml(projectName)}`,
    bodyHtml,
  });
}
