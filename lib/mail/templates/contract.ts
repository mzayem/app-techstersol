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
  partnerName,
}: {
  clientName: string;
  projectName: string;
  appUrl: string;
  /** Set when a partner submitted this from the partner portal on behalf
   * of one of their clients; omitted for a client's own proposal. */
  partnerName?: string;
}) {
  const submittedBy = partnerName ?? clientName;
  const portal = partnerName ? "partner portal" : "client portal";
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("New Proposal")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">New project proposal</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      <strong class="em-heading" style="color:#18181b;font-weight:600;">${escapeHtml(submittedBy)}</strong> just submitted a new project request from their ${portal}.
    </p>
    ${emailInfoTable(
      emailInfoRow("Project", projectName) +
        (partnerName ? emailInfoRow("Client", clientName) : "") +
        emailInfoRow("Submitted by", submittedBy),
    )}
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

/** Sent to a contract's partner or assigned team member when a dashboard
 * user adds them to a project (on create, or when an edit newly assigns
 * them) — never for a proposal the partner submitted themselves. The team
 * version leaves the client's name out, matching the team portal, which
 * never shows it either. */
export function renderContractAssignedEmail({
  audience,
  projectName,
  clientName,
  status,
  deadline,
  appUrl,
}: {
  audience: "partner" | "team";
  projectName: string;
  clientName: string;
  status: ContractStatus;
  deadline: string;
  appUrl: string;
}) {
  const isPartner = audience === "partner";
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("New Project")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">${isPartner ? "A new project has been added for you" : "You've been assigned a new project"}</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      ${isPartner ? "A project you're partnered on has been set up." : "A project has been assigned to you."} Here are the details:
    </p>
    ${emailInfoTable(
      emailInfoRow("Project", projectName) +
        (isPartner ? emailInfoRow("Client", clientName) : "") +
        emailInfoRow("Status", contractStatusBadge(status), { raw: true }) +
        emailInfoRow("Deadline", deadline),
    )}
    <div style="margin-top:28px;">${
      isPartner
        ? emailButton("View in partner portal", `${appUrl}/partner-portal/projects`)
        : emailButton("View in your portal", `${appUrl}/portal/projects`)
    }</div>
  `;
  return renderEmailShell({
    title: isPartner ? "New project added" : "New project assigned",
    bodyHtml,
  });
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
  viewUrl,
}: {
  projectName: string;
  authorLabel: string;
  message: string;
  /** Full link to wherever this recipient reads the conversation. */
  viewUrl: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("New Message")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">New note on ${escapeHtml(projectName)}</h1>
    <p class="em-muted" style="margin:0 0 20px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      <strong class="em-heading" style="color:#18181b;font-weight:600;">${escapeHtml(authorLabel)}</strong> left a message:
    </p>
    <div class="em-panel em-heading" style="background:rgba(120,120,130,0.08);border:1px solid rgba(120,120,130,0.2);border-radius:12px;padding:16px 20px;font-size:14px;line-height:1.7;color:#18181b;white-space:pre-wrap;">${escapeHtml(message)}</div>
    <div style="margin-top:28px;">${emailButton("View conversation", viewUrl)}</div>
  `;
  return renderEmailShell({
    title: `New message on ${escapeHtml(projectName)}`,
    bodyHtml,
  });
}
