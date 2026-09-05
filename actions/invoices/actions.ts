"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";
import { INVOICE_NUMBER_START, formatInvoiceNumber } from "@/lib/invoices/constants";

async function requireUserId() {
  const { data } = await auth.getSession();
  if (!data?.user) throw new Error("Not signed in");
  return data.user.id;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export type InvoiceItemInput = { description: string; amount: number };

export async function createInvoice(
  formData: FormData,
  contractIds: string[],
  items: InvoiceItemInput[],
) {
  const createdByUserId = await requireUserId();

  const clientId = str(formData, "clientId");
  const bankAccountId = str(formData, "bankAccountId");
  const currencyRaw = str(formData, "currency");
  const issueDate = str(formData, "issueDate");
  const dueDate = str(formData, "dueDate");

  if (!clientId || !bankAccountId || !issueDate || !dueDate) {
    throw new Error("Client, bank account, and dates are required");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid currency");
  }
  if (contractIds.length === 0) {
    throw new Error("Select at least one contract");
  }
  if (items.length === 0) {
    throw new Error("The invoice has no line items");
  }
  for (const item of items) {
    if (!item.description.trim() || !(item.amount > 0)) {
      throw new Error("Each line item needs a description and a positive amount");
    }
  }

  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds } },
    select: { id: true, clientId: true, currency: true },
  });
  if (contracts.length !== contractIds.length) {
    throw new Error("One or more selected contracts no longer exist");
  }
  const currency = currencyRaw as PaymentCurrency;
  for (const contract of contracts) {
    if (contract.clientId !== clientId) {
      throw new Error("Selected contracts must all belong to the selected client");
    }
    if (contract.currency !== currency) {
      throw new Error("Selected contracts must all share the same currency");
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.invoice.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = last ? last.number + 1 : INVOICE_NUMBER_START;

    try {
      await prisma.invoice.create({
        data: {
          number,
          clientId,
          bankAccountId,
          currency,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          createdByUserId,
          items: {
            create: items.map((item, index) => ({
              description: item.description.trim(),
              amount: item.amount,
              sortOrder: index,
            })),
          },
          contracts: {
            create: contractIds.map((contractId) => ({ contractId })),
          },
        },
      });
      revalidatePath("/projects/invoices");
      return;
    } catch (e) {
      const isNumberConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isNumberConflict || attempt === 2) throw e;
    }
  }
}

export async function markInvoicePaid(id: string, formData: FormData) {
  const createdByUserId = await requireUserId();

  const transactionId = str(formData, "transactionId");
  const paidOnRaw = str(formData, "paidOn");
  const pkrAmountRaw = str(formData, "pkrAmount");

  if (!transactionId) {
    throw new Error("Transaction ID is required to mark an invoice as paid");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      items: true,
      contracts: { select: { contractId: true } },
    },
  });
  if (!invoice) throw new Error("Invoice not found");

  const total = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
  const currency = invoice.currency as PaymentCurrency;

  let pkrAmount = total;
  if (currency !== "PKR") {
    pkrAmount = Number(pkrAmountRaw);
    if (!pkrAmountRaw || Number.isNaN(pkrAmount) || pkrAmount <= 0) {
      throw new Error("Enter the PKR amount received for this payment");
    }
  }

  const paidOn = paidOnRaw ? new Date(paidOnRaw) : new Date();
  const contractIds = invoice.contracts.map((c) => c.contractId);

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: { status: "PAID", paidOn, transactionId },
    }),
    prisma.contract.updateMany({
      where: { id: { in: contractIds } },
      data: { status: "COMPLETED" },
    }),
    prisma.earning.create({
      data: {
        date: paidOn,
        name: `${invoice.client.name} — Invoice ${formatInvoiceNumber(invoice.number)}`,
        amount: pkrAmount,
        referenceAmount: currency === "PKR" ? null : total,
        referenceCurrency: currency === "PKR" ? null : currency,
        createdByUserId,
      },
    }),
  ]);

  revalidatePath("/projects/invoices");
  revalidatePath("/projects/contracts");
  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
}

export async function markInvoiceUnpaid(id: string) {
  await requireUserId();

  await prisma.invoice.update({
    where: { id },
    data: { status: "UNPAID", paidOn: null, transactionId: null },
  });

  revalidatePath("/projects/invoices");
}

export async function deleteInvoice(id: string) {
  await requireUserId();

  await prisma.invoice.delete({ where: { id } });

  revalidatePath("/projects/invoices");
}
