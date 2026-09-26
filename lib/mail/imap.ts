import {
  ImapFlow,
  type MessageAddressObject,
  type MessageStructureObject,
} from "imapflow";
import { simpleParser } from "mailparser";

export type MailFolder =
  "INBOX" | "INBOX.Sent" | "INBOX.Drafts" | "INBOX.Trash";

export type MailListItem = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: Date | null;
  seen: boolean;
  flagged: boolean;
  hasAttachment: boolean;
  size: number;
};

export type MailAttachmentInfo = {
  /** Position in mailparser's `attachments` array — the key used to fetch
   * this attachment's bytes again via `getAttachment`. */
  index: number;
  filename: string;
  contentType: string;
  size: number;
};

export type MailDetail = MailListItem & {
  html: string | null;
  text: string | null;
  /** Plain address (no display name) to prefill a Reply — prefers
   * Reply-To when the sender set one, falling back to From. */
  replyToAddress: string;
  attachments: MailAttachmentInfo[];
};

function client() {
  return new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST!,
    port: Number(process.env.EMAIL_IMAP_PORT ?? 993),
    secure: true,
    auth: {
      user: process.env.EMAIL_ACCOUNT!,
      pass: process.env.EMAIL_PASSWORD!,
    },
    logger: false,
  });
}

/** Every call here opens its own short-lived connection — Next.js server
 * actions/route handlers aren't a good place to keep a persistent IMAP
 * session open between requests. */
async function withMailbox<T>(
  folder: MailFolder,
  fn: (c: ImapFlow) => Promise<T>,
): Promise<T> {
  const c = client();
  await c.connect();
  try {
    const lock = await c.getMailboxLock(folder);
    try {
      return await fn(c);
    } finally {
      lock.release();
    }
  } finally {
    await c.logout();
  }
}

/** Downloads + parses the full raw message — shared by getMessage and
 * getAttachment so both see the same attachment ordering. */
async function downloadParsed(c: ImapFlow, uid: number) {
  const raw = await c.download(String(uid), undefined, { uid: true });
  if (!raw) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of raw.content) chunks.push(chunk as Buffer);
  const buffer = Buffer.concat(chunks);
  return { buffer, parsed: await simpleParser(buffer) };
}

async function withClient<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = client();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.logout();
  }
}

function addressLine(list?: MessageAddressObject[]): string {
  if (!list || list.length === 0) return "";
  return list.map((a) => a.name || a.address).join(", ");
}

function findsAttachment(node?: MessageStructureObject): boolean {
  if (!node) return false;
  if (node.disposition?.toLowerCase() === "attachment") return true;
  return node.childNodes?.some(findsAttachment) ?? false;
}

/** Unseen-message count for the Inbox sidebar badge — a plain STATUS
 * command, no mailbox lock/message fetch needed. */
export async function getUnseenCount(folder: MailFolder): Promise<number> {
  return withClient(async (c) => {
    const status = await c.status(folder, { unseen: true });
    return status.unseen ?? 0;
  });
}

/** Newest-first, envelope-only — cheap enough to list a whole page without
 * downloading bodies. `limit`/`page` are 1-indexed pages of `limit` size. */
export async function listMessages(
  folder: MailFolder,
  { limit = 25, page = 1 }: { limit?: number; page?: number } = {},
): Promise<{ messages: MailListItem[]; total: number }> {
  return withMailbox(folder, async (c) => {
    const total =
      c.mailbox && typeof c.mailbox !== "boolean" ? c.mailbox.exists : 0;
    if (total === 0) return { messages: [], total: 0 };

    const end = total - (page - 1) * limit;
    const start = Math.max(1, end - limit + 1);
    if (end < 1) return { messages: [], total };

    const messages: MailListItem[] = [];
    for await (const msg of c.fetch(
      { seq: `${start}:${end}` },
      {
        envelope: true,
        uid: true,
        flags: true,
        bodyStructure: true,
        size: true,
      },
    )) {
      messages.push({
        uid: msg.uid,
        subject: msg.envelope?.subject ?? "(no subject)",
        from: addressLine(msg.envelope?.from),
        to: addressLine(msg.envelope?.to),
        date: msg.envelope?.date ? new Date(msg.envelope.date) : null,
        seen: msg.flags?.has("\\Seen") ?? false,
        flagged: msg.flags?.has("\\Flagged") ?? false,
        hasAttachment: findsAttachment(msg.bodyStructure),
        size: msg.size ?? 0,
      });
    }
    messages.reverse(); // newest first
    return { messages, total };
  });
}

export async function getMessage(
  folder: MailFolder,
  uid: number,
): Promise<MailDetail | null> {
  return withMailbox(folder, async (c) => {
    const envelopeMsg =
      (await c.fetchOne(
        String(uid),
        { envelope: true, flags: true, bodyStructure: true },
        { uid: true },
      )) || undefined;
    const result = await downloadParsed(c, uid);
    if (!result) return null;
    const { buffer, parsed } = result;

    return {
      uid,
      subject: parsed.subject ?? "(no subject)",
      from: parsed.from?.text ?? "",
      to: Array.isArray(parsed.to)
        ? parsed.to.map((t) => t.text).join(", ")
        : (parsed.to?.text ?? ""),
      date: parsed.date instanceof Date ? parsed.date : null,
      seen: envelopeMsg ? (envelopeMsg.flags?.has("\\Seen") ?? true) : true,
      flagged: envelopeMsg?.flags?.has("\\Flagged") ?? false,
      hasAttachment:
        parsed.attachments.length > 0 ||
        findsAttachment(envelopeMsg?.bodyStructure),
      size: buffer.length,
      html: typeof parsed.html === "string" ? parsed.html : null,
      text: parsed.text ?? null,
      replyToAddress:
        parsed.replyTo?.value?.[0]?.address ??
        parsed.from?.value?.[0]?.address ??
        "",
      attachments: parsed.attachments.map((a, index) => ({
        index,
        filename: a.filename || `attachment-${index + 1}`,
        contentType: a.contentType || "application/octet-stream",
        size: a.size ?? a.content.length,
      })),
    };
  });
}

export async function getAttachment(
  folder: MailFolder,
  uid: number,
  index: number,
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  return withMailbox(folder, async (c) => {
    const result = await downloadParsed(c, uid);
    const a = result?.parsed.attachments[index];
    if (!a) return null;
    return {
      filename: a.filename || `attachment-${index + 1}`,
      contentType: a.contentType || "application/octet-stream",
      content: a.content,
    };
  });
}

export async function markSeen(
  folder: MailFolder,
  uid: number,
  seen: boolean,
): Promise<void> {
  await withMailbox(folder, async (c) => {
    if (seen) await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    else await c.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
  });
}

export async function toggleFlagged(
  folder: MailFolder,
  uid: number,
  flagged: boolean,
): Promise<void> {
  await withMailbox(folder, async (c) => {
    if (flagged)
      await c.messageFlagsAdd(String(uid), ["\\Flagged"], { uid: true });
    else await c.messageFlagsRemove(String(uid), ["\\Flagged"], { uid: true });
  });
}

/** Moves to Trash from anywhere else; permanently deletes if it's already
 * in Trash — the same two-stage behavior as most mail clients. */
export async function deleteMessage(
  folder: MailFolder,
  uid: number,
): Promise<void> {
  await withMailbox(folder, async (c) => {
    if (folder === "INBOX.Trash") {
      await c.messageDelete(String(uid), { uid: true });
    } else {
      await c.messageMove(String(uid), "INBOX.Trash", { uid: true });
    }
  });
}
