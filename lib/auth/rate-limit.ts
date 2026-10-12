import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the window resets (only meaningful when blocked). */
  retryAfterSeconds: number;
};

/** Counts one attempt against `key` in a fixed window of `windowSeconds`,
 * allowing at most `limit` per window. A single atomic upsert, so two
 * concurrent requests can't both slip under the limit, and the count is
 * shared across server instances (in-memory counters aren't, on
 * serverless). Fails open if the database is unreachable — a limiter
 * outage must not lock everyone out of signing in. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "AuthRateLimit" ("key", "count", "windowStart")
      VALUES (${key}, 1, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "AuthRateLimit"."windowStart" < NOW() - make_interval(secs => ${windowSeconds})
          THEN 1
          ELSE "AuthRateLimit"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "AuthRateLimit"."windowStart" < NOW() - make_interval(secs => ${windowSeconds})
          THEN NOW()
          ELSE "AuthRateLimit"."windowStart"
        END
      RETURNING "count", "windowStart"
    `;
    const row = rows[0];
    if (!row) return { allowed: true, retryAfterSeconds: 0 };
    const resetsAt = row.windowStart.getTime() + windowSeconds * 1000;
    return {
      allowed: row.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)),
    };
  } catch (err) {
    console.error("[auth] rate limiter unavailable, allowing request:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** The caller's IP as seen by the host's proxy (first X-Forwarded-For hop). */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyAttemptsResponse(retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return Response.json(
    {
      code: "TOO_MANY_REQUESTS",
      message: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
