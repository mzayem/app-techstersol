import nodemailer, { type SendMailOptions } from "nodemailer";
import { ImapFlow } from "imapflow";

const globalForMail = globalThis as unknown as {
  mailTransport?: ReturnType<typeof nodemailer.createTransport>;
};

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST!,
    port: Number(process.env.EMAIL_SMTP_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.EMAIL_ACCOUNT!,
      pass: process.env.EMAIL_PASSWORD!,
    },
  });
}

const transport = globalForMail.mailTransport ?? createTransport();
if (process.env.NODE_ENV !== "production") {
  globalForMail.mailTransport = transport;
}

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
};

/** Hostinger's SMTP submission doesn't auto-file a copy into Sent (verified
 * — a self-test send left INBOX.Sent empty), so the admin Emails page's
 * "Sent" tab would otherwise always be empty for anything this app sends.
 * This builds the exact same message as raw MIME (via a buffering
 * streamTransport, never actually sent) and IMAP-appends it to Sent,
 * marked \Seen since we authored it. Best-effort — a failure here doesn't
 * fail the real send, which has already succeeded by this point. */
async function appendToSentFolder(mail: SendMailOptions) {
  try {
    const builder = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const built = await builder.sendMail(mail);
    const raw = built.message as Buffer;

    const client = new ImapFlow({
      host: process.env.EMAIL_IMAP_HOST!,
      port: Number(process.env.EMAIL_IMAP_PORT ?? 993),
      secure: true,
      auth: { user: process.env.EMAIL_ACCOUNT!, pass: process.env.EMAIL_PASSWORD! },
      logger: false,
    });
    await client.connect();
    try {
      await client.append("INBOX.Sent", raw, ["\\Seen"]);
    } finally {
      await client.logout();
    }
  } catch (err) {
    console.error("[mail] failed to file sent copy:", err);
  }
}

export async function sendMail({ to, subject, html, attachments }: SendMailInput) {
  const mail: SendMailOptions = {
    from: `"Techstersol" <${process.env.EMAIL_ACCOUNT}>`,
    to,
    subject,
    html,
    attachments,
  };

  await transport.sendMail(mail);
  await appendToSentFolder(mail);
}
