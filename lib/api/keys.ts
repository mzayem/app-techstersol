import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { clientIp, consumeRateLimit } from "@/lib/auth/rate-limit";

const KEY_PREFIX = "tsk_";

export type ApiKeyIssue = {
  /** The full secret — shown to the user once, never stored. */
  secret: string;
  keyHash: string;
  keyPrefix: string;
};

export function hashApiKey(secret: string) {
  // The secret is 256 bits of randomness, so a fast unsalted hash is fine —
  // there's nothing to brute-force.
  return createHash("sha256").update(secret).digest("hex");
}

export function issueApiKey(): ApiKeyIssue {
  const secret = KEY_PREFIX + randomBytes(32).toString("base64url");
  return {
    secret,
    keyHash: hashApiKey(secret),
    keyPrefix: secret.slice(0, KEY_PREFIX.length + 6),
  };
}

export type AuthenticatedKey = { id: string; name: string };

function error(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
) {
  return Response.json({ error: { code, message } }, { status, headers });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
) {
  return error(status, code, message, headers);
}

/** Resolves `Authorization: Bearer <key>` to an active ApiKey and applies
 * its rate limit. Returns either the key or a ready-made error Response.
 * Failed attempts are rate-limited per IP so the endpoint can't be used to
 * guess keys. */
export async function authenticateApiRequest(
  request: Request,
): Promise<{ key: AuthenticatedKey } | { response: Response }> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const key = match
    ? await prisma.apiKey.findUnique({
        where: { keyHash: hashApiKey(match[1]) },
        select: { id: true, name: true, revokedAt: true, expiresAt: true },
      })
    : null;

  if (
    !key ||
    key.revokedAt ||
    (key.expiresAt && key.expiresAt.getTime() <= Date.now())
  ) {
    const limit = await consumeRateLimit(
      `apikey-fail:${clientIp(request)}`,
      20,
      300,
    );
    if (!limit.allowed) {
      return {
        response: error(429, "too_many_requests", "Too many failed attempts.", {
          "Retry-After": String(limit.retryAfterSeconds),
        }),
      };
    }
    return {
      response: error(
        401,
        "unauthorized",
        "Missing, invalid, revoked or expired API key.",
      ),
    };
  }

  const limit = await consumeRateLimit(`apikey:${key.id}`, 120, 60);
  if (!limit.allowed) {
    return {
      response: error(429, "too_many_requests", "Rate limit exceeded.", {
        "Retry-After": String(limit.retryAfterSeconds),
      }),
    };
  }

  // Best-effort bookkeeping; never fail the request over it.
  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { key: { id: key.id, name: key.name } };
}
