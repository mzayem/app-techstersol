import { ImapFlow, type MessageAddressObject } from "imapflow";
import { simpleParser } from "mailparser";

export type MailFolder = "INBOX" | "INBOX.Sent";

export type MailListItem = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: Date | null;
  seen: boolean;
  snippet: string;
};

export type MailDetail = MailListItem & {
  html: string | null;
  text: string | null;
};

function client() {
  return new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST!,
    port: Number(process.env.EMAIL_IMAP_PORT ?? 993),
    secure: true,
    auth: { user: process.env.EMAIL_ACCOUNT!, pass: process.env.EMAIL_PASSWORD! },
    logger: false,
  });
}

/** Every call here opens its own short-lived connection — Next.js server
 * actions/route handlers aren't a good place to keep a persistent IMAP
 * session open between requests. */
async function withMailbox<T>(folder: MailFolder, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
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

function addressLine(list?: MessageAddressObject[]): string {
  if (!list || list.length === 0) return "";
  return list.map((a) => a.name || a.address).join(", ");
}

/** Newest-first, envelope-only — cheap enough to list a whole page without
 * downloading bodies. `limit`/`page` are 1-indexed pages of `limit` size. */
export async function listMessages(
  folder: MailFolder,
  { limit = 25, page = 1 }: { limit?: number; page?: number } = {},
): Promise<{ messages: MailListItem[]; total: number }> {
  return withMailbox(folder, async (c) => {
    const total = c.mailbox && typeof c.mailbox !== "boolean" ? c.mailbox.exists : 0;
    if (total === 0) return { messages: [], total: 0 };

    const end = total - (page - 1) * limit;
    const start = Math.max(1, end - limit + 1);
    if (end < 1) return { messages: [], total };

    const messages: MailListItem[] = [];
    for await (const msg of c.fetch(
      { seq: `${start}:${end}` },
      { envelope: true, uid: true, flags: true, bodyStructure: true },
    )) {
      messages.push({
        uid: msg.uid,
        subject: msg.envelope?.subject ?? "(no subject)",
        from: addressLine(msg.envelope?.from),
        to: addressLine(msg.envelope?.to),
        date: msg.envelope?.date ? new Date(msg.envelope.date) : null,
        seen: msg.flags?.has("\\Seen") ?? false,
        snippet: "",
      });
    }
    messages.reverse(); // newest first
    return { messages, total };
  });
}

export async function getMessage(folder: MailFolder, uid: number): Promise<MailDetail | null> {
  return withMailbox(folder, async (c) => {
    const raw = await c.download(String(uid), undefined, { uid: true });
    if (!raw) return null;

    const chunks: Buffer[] = [];
    for await (const chunk of raw.content) chunks.push(chunk as Buffer);
    const parsed = await simpleParser(Buffer.concat(chunks));

    return {
      uid,
      subject: parsed.subject ?? "(no subject)",
      from: parsed.from?.text ?? "",
      to: Array.isArray(parsed.to)
        ? parsed.to.map((t) => t.text).join(", ")
        : (parsed.to?.text ?? ""),
      date: parsed.date instanceof Date ? parsed.date : null,
      seen: true,
      snippet: "",
      html: typeof parsed.html === "string" ? parsed.html : null,
      text: parsed.text ?? null,
    };
  });
}
