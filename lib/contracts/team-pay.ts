import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { CONTRACT_STATUSES_EXCLUDED_FROM_PENDING } from "@/lib/contracts/constants";

/** Team pay (PKR) still owed on outsourced contracts that are still open
 * (not COMPLETED, PAUSED or CANCELLED) matching `where`:
 * - fixed-price: the contract's whole work cost;
 * - recurring: one billing period's work cost;
 * - hourly: the per-hour work cost × hours not yet on a paid invoice. */
export async function pendingContractTeamPay(where: Prisma.ContractWhereInput) {
  const contracts = await prisma.contract.findMany({
    where: {
      ...where,
      teamMemberId: { not: null },
      status: {
        notIn: ["COMPLETED", ...CONTRACT_STATUSES_EXCLUDED_FROM_PENDING],
      },
    },
    select: { id: true, paymentType: true, teamPayAmount: true },
  });

  const hourlyIds = contracts
    .filter((c) => c.paymentType === "HOURLY")
    .map((c) => c.id);
  const unpaidHours = new Map<string, number>();
  if (hourlyIds.length > 0) {
    const rows = await prisma.contractHourLog.groupBy({
      by: ["contractId"],
      where: {
        contractId: { in: hourlyIds },
        OR: [
          { invoiceItemId: null },
          { invoiceItem: { invoice: { status: "UNPAID" } } },
        ],
      },
      _sum: { hours: true },
    });
    for (const row of rows) {
      unpaidHours.set(row.contractId, Number(row._sum.hours ?? 0));
    }
  }

  return contracts.reduce((sum, c) => {
    const rate = Number(c.teamPayAmount ?? 0);
    return (
      sum +
      (c.paymentType === "HOURLY" ? rate * (unpaidHours.get(c.id) ?? 0) : rate)
    );
  }, 0);
}
