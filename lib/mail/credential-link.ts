import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { prisma } from "@/lib/prisma";

const LINK_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function encryptionKey(): Buffer {
  // CREDENTIAL_LINK_SECRET is a 64-char hex string (32 bytes) — hashed
  // down to a guaranteed-32-byte key regardless of how it was generated.
  return createHash("sha256")
    .update(process.env.CREDENTIAL_LINK_SECRET!)
    .digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

function decrypt(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Mints a one-time view link for a freshly set password. The raw token
 * only ever exists in memory here and in the email it's embedded in —
 * we store its hash, never the token itself, mirroring how a password
 * reset token would be handled. */
export async function createCredentialLink(
  appUserId: string,
  plaintextPassword: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await prisma.credentialViewLink.create({
    data: {
      appUserId,
      tokenHash: hashToken(token),
      passwordCiphertext: encrypt(plaintextPassword),
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });

  return token;
}

export type ConsumeResult =
  | { ok: true; password: string }
  | { ok: false; reason: "not_found" | "expired" | "used" };

/** Looks up a link by its token, and — if it's still valid and unused —
 * decrypts the password, marks the link used, and wipes the ciphertext in
 * the same update so nothing decryptable survives a second request even
 * if `usedAt` alone were somehow bypassed. Only ever returns the password
 * once, successfully, per link. */
export async function consumeCredentialLink(
  token: string,
): Promise<ConsumeResult> {
  const tokenHash = hashToken(token);
  const link = await prisma.credentialViewLink.findUnique({
    where: { tokenHash },
  });

  if (!link) return { ok: false, reason: "not_found" };
  if (link.usedAt || !link.passwordCiphertext)
    return { ok: false, reason: "used" };
  if (link.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };

  const password = decrypt(link.passwordCiphertext);

  await prisma.credentialViewLink.update({
    where: { id: link.id },
    data: { usedAt: new Date(), passwordCiphertext: null },
  });

  return { ok: true, password };
}
