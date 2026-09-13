"use server";

import {
  deleteMessage,
  getMessage,
  getUnseenCount,
  listMessages,
  markSeen,
  toggleFlagged,
  type MailFolder,
} from "@/lib/mail/imap";
import { sendMail, type MailAttachment } from "@/lib/mail/transport";
import { requirePagePermission } from "@/lib/rbac/permissions";

/** Everything here talks directly to the live Hostinger mailbox over
 * IMAP/SMTP on every call — there is deliberately no local database
 * involved, so this is always exactly what's really in the mailbox. */

export async function listMailbox(folder: MailFolder, page: number) {
  await requirePagePermission("emails", "view");
  return listMessages(folder, { page, limit: 25 });
}

export async function getInboxUnseenCount() {
  await requirePagePermission("emails", "view");
  return getUnseenCount("INBOX");
}

/** Opening a message marks it read, same as every other mail client. */
export async function readMailMessage(folder: MailFolder, uid: number) {
  await requirePagePermission("emails", "view");
  const message = await getMessage(folder, uid);
  if (message && !message.seen) {
    await markSeen(folder, uid, true).catch(() => {});
  }
  return message;
}

export async function setMessageFlagged(folder: MailFolder, uid: number, flagged: boolean) {
  await requirePagePermission("emails", "edit");
  await toggleFlagged(folder, uid, flagged);
}

export async function removeMailMessage(folder: MailFolder, uid: number) {
  await requirePagePermission("emails", "delete");
  await deleteMessage(folder, uid);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comma/semicolon-separated address list (Cc/Bcc style) — empty input is
 * valid (means "not set"), but anything present must parse as real
 * addresses so a typo doesn't silently vanish into a bad send. */
function parseAddressList(raw: string, fieldName: string): string[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const addresses = trimmed
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);
  for (const address of addresses) {
    if (!EMAIL_RE.test(address)) {
      throw new Error(`"${address}" in ${fieldName} isn't a valid email address`);
    }
  }
  return addresses;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function composeEmail(formData: FormData) {
  await requirePagePermission("emails", "create");

  const to = str(formData, "to");
  const subject = str(formData, "subject");
  const bodyText = str(formData, "bodyText");
  if (!to || !EMAIL_RE.test(to)) {
    throw new Error("Enter a valid recipient email address");
  }
  if (!subject) throw new Error("Subject is required");
  if (!bodyText) throw new Error("Message can't be empty");

  const cc = parseAddressList(str(formData, "cc"), "Cc");
  const bcc = parseAddressList(str(formData, "bcc"), "Bcc");

  const files = formData.getAll("attachments").filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
  const attachments: MailAttachment[] = await Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || undefined,
    })),
  );

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;white-space:pre-wrap;">${escapeHtml(bodyText)}</div>`;
  await sendMail({
    to,
    cc,
    bcc,
    subject,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
