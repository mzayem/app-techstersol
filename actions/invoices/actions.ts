"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import { INVOICE_NUMBER_START, formatInvoiceNumber } from "@/lib/invoices/constants";
import { remainingKey } from "@/actions/invoices/queries";

async function requireUserId() {
  const { data } = await auth.getSession();
  if (!data?.user) throw new Error("Not signed in");
  return data.user.id;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** A statuses whose balance a paid invoice is allowed to have completed —
 * marking an invoice unpaid/deleting it reverts them back to pending
 * payment rather than guessing their prior status. */
const PAID_CONTRACT_STATUSES = ["COMPLETED", "PARTIALLY_PAID"] as const;

export type InvoiceItemInput = {
  contractId: string;
  milestoneId: string | null;
  description: string;
  amount: number;
};

export async function createInvoice(formData: FormData, items: InvoiceItemInput[]) {
  const createdByUserId = await requireUserId();

  const clientId = str(formData, "clientId");
  const bankAccountId = str(formData, "bankAccountId");
  const currencyRaw = str(formData, "currency");
  const issueDate = str(formData, "issueDate");
  const dueDate = str(formData, "dueDate");
  const discountRaw = str(formData, "discount");

  if (!clientId || !bankAccountId || !issueDate || !dueDate) {
    throw new Error("Client, bank account, and dates are required");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid currency");
  }
  if (items.length === 0) {
    throw new Error("Select at least one contract or milestone");
  }
  for (const item of items) {
    if (!item.contractId || !item.description.trim() || !(item.amount > 0)) {
      throw new Error("Each line item needs a source, a description, and a positive amount");
    }
  }

  const currency = currencyRaw as PaymentCurrency;
  const contractIds = [...new Set(items.map((item) => item.contractId))];

  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds } },
    select: {
      id: true,
      clientId: true,
      currency: true,
      paymentType: true,
      amount: true,
      milestones: { select: { id: true, amount: true } },
    },
  });
  if (contracts.length !== contractIds.length) {
    throw new Error("One or more selected contracts no longer exist");
  }
  for (const contract of contracts) {
    if (contract.clientId !== clientId) {
      throw new Error("Selected contracts must all belong to the selected client");
    }
    if (contract.currency !== currency) {
      throw new Error("Selected contracts must all share the same currency");
    }
  }

  const paidItems = await prisma.invoiceItem.findMany({
    where: { contractId: { in: contractIds }, invoice: { status: "PAID" } },
    select: { contractId: true, milestoneId: true, amount: true },
  });
  const paid = new Map<string, number>();
  for (const paidItem of paidItems) {
    const key = remainingKey(paidItem.contractId!, paidItem.milestoneId);
    paid.set(key, (paid.get(key) ?? 0) + Number(paidItem.amount));
  }

  const contractsById = new Map(contracts.map((c) => [c.id, c]));
  const preparedItems = items.map((item, index) => {
    const contract = contractsById.get(item.contractId)!;
    const faceAmount = item.milestoneId
      ? Number(contract.milestones.find((m) => m.id === item.milestoneId)?.amount ?? 0)
      : Number(contract.amount ?? 0);
    const alreadyPaid = paid.get(remainingKey(item.contractId, item.milestoneId)) ?? 0;
    const remaining = faceAmount - alreadyPaid;

    if (remaining <= 0.01) {
      throw new Error("One of the selected lines has already been paid in full");
    }
    if (item.amount > remaining + 0.01) {
      throw new Error("A line item's amount can't exceed its remaining balance");
    }

    const isPartial = item.amount < remaining - 0.01;
    const description = isPartial
      ? `${item.description.trim()} (Partial payment — remaining ${formatContractAmount(
          remaining - item.amount,
          currency,
        )})`
      : item.description.trim();

    return {
      description,
      amount: item.amount,
      contractId: item.contractId,
      milestoneId: item.milestoneId,
      isPartial,
      sortOrder: index,
    };
  });

  const discount = discountRaw ? Number(discountRaw) : 0;
  if (Number.isNaN(discount) || discount < 0) {
    throw new Error("Discount must be zero or a positive amount");
  }
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (discount > total) {
    throw new Error("Discount can't be more than the invoice total");
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
          discount,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          createdByUserId,
          items: { create: preparedItems },
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
  const balanceDue = total - Number(invoice.discount);
  const currency = invoice.currency as PaymentCurrency;

  let pkrAmount = balanceDue;
  if (currency !== "PKR") {
    pkrAmount = Number(pkrAmountRaw);
    if (!pkrAmountRaw || Number.isNaN(pkrAmount) || pkrAmount <= 0) {
      throw new Error("Enter the PKR amount received for this payment");
    }
  }

  const paidOn = paidOnRaw ? new Date(paidOnRaw) : new Date();
  const contractIds = invoice.contracts.map((c) => c.contractId);

  const contracts =
    contractIds.length > 0
      ? await prisma.contract.findMany({
          where: { id: { in: contractIds } },
          select: {
            id: true,
            status: true,
            paymentType: true,
            amount: true,
            milestones: { select: { amount: true } },
          },
        })
      : [];

  const alreadyPaidItems =
    contractIds.length > 0
      ? await prisma.invoiceItem.findMany({
          where: {
            contractId: { in: contractIds },
            invoice: { status: "PAID", id: { not: id } },
          },
          select: { contractId: true, amount: true },
        })
      : [];
  const alreadyPaidByContract = new Map<string, number>();
  for (const item of alreadyPaidItems) {
    alreadyPaidByContract.set(
      item.contractId!,
      (alreadyPaidByContract.get(item.contractId!) ?? 0) + Number(item.amount),
    );
  }

  const completedIds: string[] = [];
  const partiallyPaidIds: string[] = [];
  for (const contract of contracts) {
    const totalBillable =
      contract.paymentType === "PROJECT"
        ? Number(contract.amount ?? 0)
        : contract.milestones.reduce((sum, m) => sum + Number(m.amount), 0);
    const thisInvoiceSum = invoice.items
      .filter((item) => item.contractId === contract.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const totalPaid = (alreadyPaidByContract.get(contract.id) ?? 0) + thisInvoiceSum;
    const remaining = totalBillable - totalPaid;
    const hasPartialItem = invoice.items.some(
      (item) => item.contractId === contract.id && item.isPartial,
    );

    if (remaining <= 0.01) {
      completedIds.push(contract.id);
    } else if (hasPartialItem && contract.status === "PENDING_PAYMENT") {
      partiallyPaidIds.push(contract.id);
    }
  }

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: { status: "PAID", paidOn, transactionId },
    }),
    ...(completedIds.length > 0
      ? [
          prisma.contract.updateMany({
            where: { id: { in: completedIds } },
            data: { status: "COMPLETED" },
          }),
        ]
      : []),
    ...(partiallyPaidIds.length > 0
      ? [
          prisma.contract.updateMany({
            where: { id: { in: partiallyPaidIds } },
            data: { status: "PARTIALLY_PAID" },
          }),
        ]
      : []),
    prisma.earning.create({
      data: {
        date: paidOn,
        name: `${invoice.client.name} — Invoice ${formatInvoiceNumber(invoice.number)}`,
        amount: pkrAmount,
        referenceAmount: currency === "PKR" ? null : balanceDue,
        referenceCurrency: currency === "PKR" ? null : currency,
        invoiceId: id,
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

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, contracts: { select: { contractId: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "UNPAID") return;

  const contractIds = invoice.contracts.map((c) => c.contractId);

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: { status: "UNPAID", paidOn: null, transactionId: null },
    }),
    prisma.contract.updateMany({
      where: { id: { in: contractIds }, status: { in: [...PAID_CONTRACT_STATUSES] } },
      data: { status: "PENDING_PAYMENT" },
    }),
    prisma.earning.deleteMany({ where: { invoiceId: id } }),
  ]);

  revalidatePath("/projects/invoices");
  revalidatePath("/projects/contracts");
  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
}

export async function deleteInvoice(id: string) {
  await requireUserId();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, contracts: { select: { contractId: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");

  if (invoice.status === "PAID") {
    const contractIds = invoice.contracts.map((c) => c.contractId);
    await prisma.$transaction([
      prisma.contract.updateMany({
        where: { id: { in: contractIds }, status: { in: [...PAID_CONTRACT_STATUSES] } },
        data: { status: "PENDING_PAYMENT" },
      }),
      prisma.invoice.delete({ where: { id } }),
    ]);
    revalidatePath("/projects/contracts");
    revalidatePath("/account/earning");
    revalidatePath("/account/distributions");
  } else {
    await prisma.invoice.delete({ where: { id } });
  }

  revalidatePath("/projects/invoices");
}
