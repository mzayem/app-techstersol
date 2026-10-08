import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/** Project/hourly contracts are numbered 101, 102…; recurring ones 301,
 * 302…. Both share one unique column, so a series that runs into the
 * other's numbers just skips past them. */
const SERIES_START = { project: 101, recurring: 301 } as const;

export function contractSeries(paymentType: string) {
  return paymentType === "RECURRING" ? "recurring" : "project";
}

async function nextContractNumber(series: keyof typeof SERIES_START) {
  const last = await prisma.contract.findFirst({
    where:
      series === "recurring"
        ? { paymentType: "RECURRING" }
        : { paymentType: { not: "RECURRING" } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  let candidate = Math.max(
    SERIES_START[series],
    (last?.number ?? 0) + 1,
  );
  while (
    await prisma.contract.findUnique({
      where: { number: candidate },
      select: { id: true },
    })
  ) {
    candidate++;
  }
  return candidate;
}

/** Creates a contract with the next number in its series, retrying when a
 * concurrent create grabbed the same number first. */
export async function createNumberedContract(
  data: Omit<Prisma.ContractUncheckedCreateInput, "number">,
) {
  for (let attempt = 0; ; attempt++) {
    const number = await nextContractNumber(contractSeries(data.paymentType));
    try {
      return await prisma.contract.create({ data: { ...data, number } });
    } catch (e) {
      const isNumberConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isNumberConflict || attempt === 2) throw e;
    }
  }
}
