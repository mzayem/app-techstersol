"use server";

import { getMessage, listMessages, type MailFolder } from "@/lib/mail/imap";
import { sendMail } from "@/lib/mail/transport";
import { requirePagePermission } from "@/lib/rbac/permissions";

/** Everything here talks directly to the live Hostinger mailbox over
 * IMAP/SMTP on every call — there is deliberately no local database
 * involved, so this is always exactly what's really in the mailbox. */

export async function listMailbox(folder: MailFolder, page: number) {
  await requirePagePermission("emails", "view");
  return listMessages(folder, { page, limit: 25 });
}

export async function readMailMessage(folder: MailFolder, uid: number) {
  await requirePagePermission("emails", "view");
  return getMessage(folder, uid);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function composeEmail({
  to,
  subject,
  bodyText,
}: {
  to: string;
  subject: string;
  bodyText: string;
}) {
  await requirePagePermission("emails", "create");

  const trimmedTo = to.trim();
  const trimmedSubject = subject.trim();
  const trimmedBody = bodyText.trim();
  if (!trimmedTo || !EMAIL_RE.test(trimmedTo)) {
    throw new Error("Enter a valid recipient email address");
  }
  if (!trimmedSubject) throw new Error("Subject is required");
  if (!trimmedBody) throw new Error("Message can't be empty");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;white-space:pre-wrap;">${escapeHtml(trimmedBody)}</div>`;
  await sendMail({ to: trimmedTo, subject: trimmedSubject, html });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
