import { NextResponse } from "next/server";

import { getAttachment, type MailFolder } from "@/lib/mail/imap";
import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLDERS: MailFolder[] = [
  "INBOX",
  "INBOX.Sent",
  "INBOX.Drafts",
  "INBOX.Trash",
];

/** Types a browser can safely render in a tab — everything else is forced
 * to download so an attached .html/.svg can't run script on our origin. */
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);

/** GET /api/mail/attachment?folder=INBOX&uid=123&index=0[&download=1] */
export async function GET(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (
    appUser.kind !== "DASHBOARD_HANDLER" ||
    !checkPermission(appUser, "emails", "view")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const folder = params.get("folder") as MailFolder;
  const uid = Number(params.get("uid"));
  const index = Number(params.get("index"));
  if (
    !FOLDERS.includes(folder) ||
    !Number.isInteger(uid) ||
    uid < 1 ||
    !Number.isInteger(index) ||
    index < 0
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const attachment = await getAttachment(folder, uid, index);
  if (!attachment) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 },
    );
  }

  const contentType = attachment.contentType.toLowerCase();
  const inline =
    params.get("download") !== "1" && INLINE_TYPES.has(contentType);
  const safeName = attachment.filename.replace(/["\r\n\\]/g, "_");

  return new NextResponse(new Uint8Array(attachment.content), {
    headers: {
      "Content-Type": inline ? contentType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
