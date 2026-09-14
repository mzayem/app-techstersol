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
import { saveDraft, sendMail, type MailAttachment } from "@/lib/mail/transport";
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

export async function setMessageFlagged(
  folder: MailFolder,
  uid: number,
  flagged: boolean,
) {
  await requirePagePermission("emails", "edit");
  await toggleFlagged(folder, uid, flagged);
}

export async function setMessageSeen(
  folder: MailFolder,
  uid: number,
  seen: boolean,
) {
  await requirePagePermission("emails", "edit");
  await markSeen(folder, uid, seen);
}

export async function removeMailMessage(folder: MailFolder, uid: number) {
  await requirePagePermission("emails", "delete");
  await deleteMessage(folder, uid);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comma/semicolon-separated address list (Cc/Bcc style) — empty input is
 * valid (means "not set"), but anything present must parse as real
 * addresses so a typo doesn't silently vanish into a bad send. */
function parseAddressList(
  raw: string,
  fieldName: string,
): string[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const addresses = trimmed
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);
  for (const address of addresses) {
    if (!EMAIL_RE.test(address)) {
      throw new Error(
        `"${address}" in ${fieldName} isn't a valid email address`,
      );
    }
  }
  return addresses;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Strips the handful of tags/attributes that don't belong in an outbound
 * email (or a stored draft) — the body comes from an admin's own
 * contentEditable composer, not untrusted input, so this is a safety net
 * against accidental script/style tags rather than a hostile-input filter. */
function sanitizeBodyHtml(value: string): string {
  return value
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

async function readComposeFormData(formData: FormData) {
  const cc = parseAddressList(str(formData, "cc"), "Cc");
  const bcc = parseAddressList(str(formData, "bcc"), "Bcc");
  const subject = str(formData, "subject");
  const bodyHtml = str(formData, "bodyHtml");
  const bodyText = str(formData, "bodyText");

  const files = formData
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const attachments: MailAttachment[] = await Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || undefined,
    })),
  );

  const html = bodyHtml
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;">${sanitizeBodyHtml(bodyHtml)}</div>`
    : bodyText
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;white-space:pre-wrap;">${escapeHtml(bodyText)}</div>`
      : "";

  return {
    cc,
    bcc,
    subject,
    html,
    attachments,
    hasBody: !!(bodyHtml || bodyText),
  };
}

/** Deletes the draft a message was composed from, once it's been sent or
 * re-saved as a new draft — best-effort, since the send/save it follows has
 * already succeeded by this point. */
async function deleteSourceDraft(formData: FormData) {
  const draftFolder = str(formData, "sourceDraftFolder") as MailFolder | "";
  const draftUid = str(formData, "sourceDraftUid");
  if (draftFolder && draftUid) {
    await deleteMessage(draftFolder, Number(draftUid)).catch(() => {});
  }
}

export async function composeEmail(formData: FormData) {
  await requirePagePermission("emails", "create");

  const to = str(formData, "to");
  if (!to || !EMAIL_RE.test(to)) {
    throw new Error("Enter a valid recipient email address");
  }
  const { cc, bcc, subject, html, attachments, hasBody } =
    await readComposeFormData(formData);
  if (!subject) throw new Error("Subject is required");
  if (!hasBody) throw new Error("Message can't be empty");

  await sendMail({
    to,
    cc,
    bcc,
    subject,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  await deleteSourceDraft(formData);
}

/** Files the composer's current contents into Drafts without sending —
 * `to`/subject/body can all be empty, since a draft is by definition
 * unfinished. */
export async function saveDraftEmail(formData: FormData) {
  await requirePagePermission("emails", "create");

  const to = str(formData, "to");
  if (to && !EMAIL_RE.test(to)) {
    throw new Error("Enter a valid recipient email address");
  }
  const { cc, bcc, subject, html, attachments } =
    await readComposeFormData(formData);

  await saveDraft({
    to: to || undefined,
    cc,
    bcc,
    subject,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  await deleteSourceDraft(formData);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
