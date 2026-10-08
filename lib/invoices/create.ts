import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { INVOICE_NUMBER_START } from "@/lib/invoices/constants";

/** Creates an invoice with the next sequential number, retrying when a
 * concurrent create grabbed the same number first (unique violation). */
export async function createNumberedInvoice(
  data: Omit<Prisma.InvoiceUncheckedCreateInput, "number">,
) {
  for (let attempt = 0; ; attempt++) {
    const last = await prisma.invoice.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = last ? last.number + 1 : INVOICE_NUMBER_START;

    try {
      return await prisma.invoice.create({
        data: { ...data, number },
        include: { client: { select: { name: true } } },
      });
    } catch (e) {
      const isNumberConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isNumberConflict || attempt === 2) throw e;
    }
  }
}
