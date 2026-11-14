import { apiError, authenticateApiRequest } from "@/lib/api/keys";
import { logActivity } from "@/lib/activity/log";
import { formatContractAmount } from "@/lib/contracts/constants";
import {
  deletePushedEarning,
  revalidateEarningPages,
} from "@/lib/finance/earning-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Removes an earning this API key's software pushed earlier — the "mark
 * invoice unpaid" case. Only earnings created through the API under the
 * same software name can be removed; anything else (manual earnings, other
 * software's, invoice-linked ones) answers 404, same as an unknown id. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await authenticateApiRequest(request);
  if ("response" in authed) return authed.response;
  const { key } = authed;

  const { id } = await params;
  const removed = await deletePushedEarning(id, key.name);
  if (!removed) {
    return apiError(
      404,
      "not_found",
      "No earning with this id was pushed by this API key's software (it may already be removed).",
    );
  }

  // The earning is already gone: a failure here must not become a 500.
  try {
    await logActivity(
      { id: `api:${key.id}`, name: key.name, email: "" },
      {
        action: "deleted",
        entityType: "earning",
        entityId: removed.id,
        summary: `Removed earning "${removed.name}" (${formatContractAmount(Number(removed.amount), "PKR")}) via API`,
        page: "earning",
      },
    );
    revalidateEarningPages();
  } catch (err) {
    console.error("[api/v1/earnings] post-delete step failed:", err);
  }

  return Response.json({ id: removed.id, deleted: true });
}
