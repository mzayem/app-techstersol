import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReferenceCurrency } from "@/lib/finance/constants";

type LedgerEntryInput = {
  type: "EARNING" | "EXPENSE" | "DONATION" | "TEAM_PAYMENT";
  name: string;
  date: Date;
  debit?: string;
  credit?: string;
};

/** An earning always credits the ledger for its full (gross) amount; a
 * teamPay cut is a separate debit, since that money actually left the
 * company for the team member rather than never having arrived. */
export function earningLedgerEntries(
  name: string,
  date: Date,
  amount: string,
  teamPay: string,
): LedgerEntryInput[] {
  const entries: LedgerEntryInput[] = [
    { type: "EARNING", name, date, credit: amount },
  ];
  if (Number(teamPay) > 0) {
    entries.push({
      type: "TEAM_PAYMENT",
      name: `Team pay — ${name}`,
      date,
      debit: teamPay,
    });
  }
  return entries;
}

/** Every page whose numbers an earning feeds into. */
export function revalidateEarningPages() {
  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/expenses");
  revalidatePath("/account/donations");
  revalidatePath("/account/balance-sheet");
}

/** Removes an earning that `source` pushed in through the API (its ledger
 * entries cascade), e.g. when the calling software marks an invoice unpaid.
 * Scoped by source on purpose: a key can never touch manual earnings, ones
 * linked to an invoice here, or ones another software pushed — those all
 * look like "not found". Returns the removed row, or null. */
export async function deletePushedEarning(id: string, source: string) {
  const earning = await prisma.earning.findFirst({ where: { id, source } });
  if (!earning) return null;
  // deleteMany so a concurrent delete of the same row is a no-op, not a throw.
  const { count } = await prisma.earning.deleteMany({ where: { id, source } });
  return count > 0 ? earning : null;
}

export type PushedEarningInput = {
  /** The calling software (the ApiKey's name). */
  source: string;
  /** That software's own id for this payment — makes a retry a no-op. */
  externalId: string;
  /** YYYY-MM-DD, business-timezone calendar day. */
  date: string;
  name: string;
  /** PKR actually received, net of fees. */
  amount: string;
  teamPay: string;
  referenceAmount?: string;
  referenceCurrency?: ReferenceCurrency;
  /** Who/what booked it — an ApiKey is recorded as "api:<id>". */
  createdByUserId: string;
};

/** Books an earning pushed in from another piece of software, exactly the
 * way the manual form does (the Earning row plus its ledger entries).
 * Idempotent on (source, externalId): a repeat returns the existing
 * earning with `created: false` and changes nothing — including when two
 * identical requests race, which the unique index settles. */
export async function createPushedEarning(input: PushedEarningInput) {
  const existing = await prisma.earning.findUnique({
    where: {
      source_externalId: {
        source: input.source,
        externalId: input.externalId,
      },
    },
  });
  if (existing) return { earning: existing, created: false as const };

  const dateObj = new Date(input.date);
  try {
    const earning = await prisma.earning.create({
      data: {
        date: dateObj,
        name: input.name,
        amount: input.amount,
        teamPay: input.teamPay,
        referenceAmount: input.referenceAmount,
        referenceCurrency: input.referenceCurrency,
        source: input.source,
        externalId: input.externalId,
        createdByUserId: input.createdByUserId,
        ledgerEntries: {
          create: earningLedgerEntries(
            input.name,
            dateObj,
            input.amount,
            input.teamPay,
          ),
        },
      },
    });
    return { earning, created: true as const };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const winner = await prisma.earning.findUnique({
        where: {
          source_externalId: {
            source: input.source,
            externalId: input.externalId,
          },
        },
      });
      if (winner) return { earning: winner, created: false as const };
    }
    throw e;
  }
}
