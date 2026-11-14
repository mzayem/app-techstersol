import { z } from "zod";

import { apiError, authenticateApiRequest } from "@/lib/api/keys";
import { logActivity } from "@/lib/activity/log";
import { formatContractAmount } from "@/lib/contracts/constants";
import { todayIso } from "@/lib/date/iso";
import { REFERENCE_CURRENCIES } from "@/lib/finance/constants";
import {
  createPushedEarning,
  revalidateEarningPages,
} from "@/lib/finance/earning-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const money = z
  .number()
  .finite()
  // Column is Decimal(14,2): 999,999,999,999.99 is the largest it holds.
  .max(999_999_999_999.99)
  .refine((n) => Number(n.toFixed(2)) === n, {
    message: "Use at most 2 decimal places",
  });

const bodySchema = z
  .object({
    externalId: z.string().trim().min(1).max(200),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      // Round-trip, so a rolled-over date like 2026-02-31 is rejected.
      .refine((d) => {
        const parsed = new Date(d);
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === d
        );
      }, "Invalid date")
      .optional(),
    name: z.string().trim().min(1).max(200),
    amount: money.positive(),
    teamPay: money.min(0).optional(),
    referenceAmount: money.positive().optional(),
    referenceCurrency: z.enum(REFERENCE_CURRENCIES).optional(),
  })
  .refine(
    (b) =>
      (b.referenceAmount === undefined) === (b.referenceCurrency === undefined),
    {
      message: "referenceAmount and referenceCurrency go together",
      path: ["referenceAmount"],
    },
  )
  .refine((b) => (b.teamPay ?? 0) <= b.amount, {
    message: "teamPay can't exceed amount",
    path: ["teamPay"],
  });

/** Books an earning pushed in by another piece of software. Excluded from
 * the session proxy — authenticated by an API key issued under
 * Admin → API Keys. Idempotent on `externalId` per key name. */
export async function POST(request: Request) {
  const authed = await authenticateApiRequest(request);
  if ("response" in authed) return authed.response;
  const { key } = authed;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(
      422,
      "invalid_request",
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; "),
    );
  }
  const body = parsed.data;

  const { earning, created } = await createPushedEarning({
    source: key.name,
    externalId: body.externalId,
    date: body.date ?? todayIso(),
    name: body.name,
    amount: body.amount.toFixed(2),
    teamPay: (body.teamPay ?? 0).toFixed(2),
    referenceAmount: body.referenceAmount?.toFixed(2),
    referenceCurrency: body.referenceCurrency,
    createdByUserId: `api:${key.id}`,
  });

  if (created) {
    // The earning is already committed: a failure here must not turn into a
    // 500, or the retry would see "already exists" and skip these for good.
    try {
      await logActivity(
        { id: `api:${key.id}`, name: key.name, email: "" },
        {
          action: "created",
          entityType: "earning",
          entityId: earning.id,
          summary: `Added earning "${earning.name}" (${formatContractAmount(Number(earning.amount), "PKR")}) via API`,
          page: "earning",
        },
      );
      revalidateEarningPages();
    } catch (err) {
      console.error("[api/v1/earnings] post-create step failed:", err);
    }
  }

  return Response.json(
    { id: earning.id, created },
    { status: created ? 201 : 200 },
  );
}
