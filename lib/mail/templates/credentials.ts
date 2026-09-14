import {
  emailBadge,
  emailButton,
  emailInfoRow,
  emailInfoTable,
  escapeHtml,
  renderEmailShell,
} from "./shell";

export function renderCredentialsEmail({
  name,
  email,
  viewUrl,
}: {
  name: string;
  email: string;
  viewUrl: string;
}) {
  const bodyHtml = `
    <div style="margin-bottom:20px;">${emailBadge("Account Access")}</div>
    <h1 class="em-heading" style="margin:0 0 12px 0;font-size:26px;font-weight:800;color:#18181b;">Welcome, ${escapeHtml(name)}</h1>
    <p class="em-muted" style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#5b5b62;font-weight:300;">
      Your Techstersol account is ready. For security, your password isn't included in this
      email — use the button below to view it once. The link expires after it's viewed, or
      after 48 hours, whichever comes first.
    </p>
    ${emailInfoTable(emailInfoRow("Sign-in email", email))}
    <div style="margin-top:28px;">${emailButton("View my password", viewUrl)}</div>
    <p class="em-footer" style="margin:24px 0 0 0;font-size:12px;line-height:1.7;color:rgba(0,0,0,0.4);">
      Didn't expect this email? Contact your administrator — someone may have entered your
      email address by mistake.
    </p>
  `;
  return renderEmailShell({ title: "Your Techstersol account", bodyHtml });
}
