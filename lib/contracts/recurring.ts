import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity/log";
import {
  BILLING_CYCLE_LABELS,
  RECURRING_BILLING_STATUSES,
  formatContractAmount,
  type BillingCycle,
} from "@/lib/contracts/constants";
import {
  addDaysUtc,
  firstCurrentPeriodStart,
  formatPeriod,
  nextPeriodStart,
  periodEnd,
  startOfDayUtc,
} from "@/lib/contracts/billing";
import { formatInvoiceNumber } from "@/lib/invoices/constants";
import { createNumberedInvoice } from "@/lib/invoices/create";
import { notifyInvoiceCreated } from "@/lib/mail/notifications/invoices";

/** Most periods a single run will invoice for one contract — a safety cap
 * so a misconfigured date can never fire off a flood of invoices. */
const MAX_PERIODS_PER_RUN = 3;

export type RecurringRunResult = {
  created: number;
  skipped: number;
  failed: number;
};

export function isRecurringBillingStatus(status: string) {
  return (RECURRING_BILLING_STATUSES as readonly string[]).includes(status);
}

/** Where a RECURRING contract's next invoice period should start, given
 * its current state. Called whenever a contract is created or edited:
 * - picks up after the last period already invoiced (or the start date if
 *   none has been), and
 * - when it's just been switched into a billing status (created active,
 *   resumed from paused, draft approved…) or its schedule changed, skips
 *   periods that already ended — billing starts from the current period,
 *   never a backlog nobody was invoicing for. */
export async function resolveNextInvoiceDate({
  contractId,
  startDate,
  cycle,
  enteringBilling,
  previousNext,
  now = new Date(),
}: {
  contractId: string | null;
  startDate: Date;
  cycle: BillingCycle;
  enteringBilling: boolean;
  previousNext: Date | null;
  now?: Date;
}) {
  const anchorDay = startDate.getUTCDate();
  const lastBilled = contractId
    ? await prisma.invoiceItem.findFirst({
        where: { contractId, periodEnd: { not: null } },
        orderBy: { periodEnd: "desc" },
        select: { periodEnd: true },
      })
    : null;

  const base = lastBilled?.periodEnd
    ? addDaysUtc(lastBilled.periodEnd, 1)
    : startOfDayUtc(startDate);

  const scheduleChanged =
    !previousNext || previousNext.getTime() !== base.getTime();
  if (!enteringBilling && !scheduleChanged) return base;
  return firstCurrentPeriodStart(base, cycle, anchorDay, startOfDayUtc(now));
}

/** Generates (and emails) every recurring invoice that's due — one per
 * billing period whose start date has arrived — for RECURRING contracts
 * that are ACTIVE or PENDING_PAYMENT. Paused, draft, cancelled and
 * completed contracts are never invoiced. Safe to run repeatedly: each
 * period is claimed atomically before its invoice is created. Pass
 * `contractId` to run it for a single contract (right after it's saved). */
export async function generateDueRecurringInvoices({
  now = new Date(),
  contractId,
}: { now?: Date; contractId?: string } = {}): Promise<RecurringRunResult> {
  const today = startOfDayUtc(now);
  const result: RecurringRunResult = { created: 0, skipped: 0, failed: 0 };

  const contracts = await prisma.contract.findMany({
    where: {
      ...(contractId ? { id: contractId } : {}),
      paymentType: "RECURRING",
      status: { in: [...RECURRING_BILLING_STATUSES] },
      nextInvoiceDate: { lte: today },
    },
    select: {
      id: true,
      clientId: true,
      number: true,
      projectName: true,
      date: true,
      deadline: true,
      currency: true,
      amount: true,
      billingCycle: true,
      nextInvoiceDate: true,
      invoiceDueDays: true,
      bankAccountId: true,
      createdByUserId: true,
      client: { select: { name: true } },
    },
  });

  for (const contract of contracts) {
    const cycle = contract.billingCycle as BillingCycle | null;
    const amount = Number(contract.amount ?? 0);
    if (!cycle || !contract.bankAccountId || !(amount > 0)) {
      result.skipped++;
      continue;
    }
    const anchorDay = contract.date.getUTCDate();
    let next = contract.nextInvoiceDate!;

    for (let i = 0; i < MAX_PERIODS_PER_RUN; i++) {
      if (next > today) break;
      if (contract.deadline && next > contract.deadline) break;

      const start = next;
      const end = periodEnd(start, cycle, anchorDay, contract.deadline);
      const following = nextPeriodStart(start, cycle, anchorDay);

      // Claim this period first, conditional on the date we read — two
      // overlapping runs can never both invoice the same period.
      const claimed = await prisma.contract.updateMany({
        where: {
          id: contract.id,
          nextInvoiceDate: start,
          status: { in: [...RECURRING_BILLING_STATUSES] },
        },
        data: { nextInvoiceDate: following },
      });
      if (claimed.count === 0) {
        result.skipped++;
        break;
      }

      try {
        const invoice = await createNumberedInvoice({
          clientId: contract.clientId,
          bankAccountId: contract.bankAccountId,
          currency: contract.currency,
          issueDate: today,
          dueDate: addDaysUtc(today, contract.invoiceDueDays),
          createdByUserId: contract.createdByUserId,
          items: {
            create: [
              {
                description: `${contract.projectName} (contract #${contract.number}) — ${BILLING_CYCLE_LABELS[cycle].toLowerCase()} service, ${formatPeriod(start, end)}`,
                amount,
                contractId: contract.id,
                periodStart: start,
                periodEnd: end,
                sortOrder: 0,
              },
            ],
          },
          contracts: { create: [{ contractId: contract.id }] },
        });

        await prisma.contract.updateMany({
          where: { id: contract.id, status: "ACTIVE" },
          data: { status: "PENDING_PAYMENT" },
        });

        await notifyInvoiceCreated(invoice.id);
        await logActivity(null, {
          action: "created",
          entityType: "invoice",
          entityId: invoice.id,
          summary: `Auto-generated invoice ${formatInvoiceNumber(invoice.number)} for ${contract.client.name} — "${contract.projectName}", ${formatPeriod(start, end)} (${formatContractAmount(amount, contract.currency)})`,
          page: "invoices",
        });
        result.created++;
        next = following;
      } catch (err) {
        console.error(
          `[recurring] contract "${contract.projectName}" failed:`,
          err,
        );
        // Give the period back so the next run retries it.
        await prisma.contract
          .updateMany({
            where: { id: contract.id, nextInvoiceDate: following },
            data: { nextInvoiceDate: start },
          })
          .catch(() => {});
        result.failed++;
        break;
      }
    }
  }

  return result;
}
