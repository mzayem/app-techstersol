"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  PAYMENT_CURRENCIES,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import {
  contractRevenueBasis,
  formatContractAmount,
} from "@/lib/contracts/constants";
import {
  INVOICE_NUMBER_START,
  formatInvoiceNumber,
} from "@/lib/invoices/constants";
import {
  invoicedAmountsByLine,
  remainingKey,
} from "@/actions/invoices/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";
import {
  notifyInvoiceCreated,
  notifyInvoicePaid,
} from "@/lib/mail/notifications/invoices";
import {
  planInvoiceEarning,
  writeInvoiceEarning,
} from "@/lib/invoices/earning";
import { logActivity } from "@/lib/activity/log";

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

export async function createInvoice(
  formData: FormData,
  items: InvoiceItemInput[],
) {
  const { appUser } = await requirePagePermission("invoices", "create");
  const createdByUserId = appUser.authUserId;

  const clientId = str(formData, "clientId");
  const bankAccountId = str(formData, "bankAccountId");
  const currencyRaw = str(formData, "currency");
  const issueDate = str(formData, "issueDate");
  const dueDate = str(formData, "dueDate");
  const discountRaw = str(formData, "discount");
  const remindersEnabled = str(formData, "remindersEnabled") === "true";

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
      throw new Error(
        "Each line item needs a source, a description, and a positive amount",
      );
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
      throw new Error(
        "Selected contracts must all belong to the selected client",
      );
    }
    if (contract.currency !== currency) {
      throw new Error("Selected contracts must all share the same currency");
    }
  }

  // Nets out every existing invoice against a line (paid or not) so the
  // same balance can't be invoiced twice while a prior invoice is still
  // outstanding — mirrors listInvoiceSources' option list, which already
  // hides a line here entirely once nothing is left to invoice.
  const invoiced = await invoicedAmountsByLine(contractIds);

  const contractsById = new Map(contracts.map((c) => [c.id, c]));
  const preparedItems = items.map((item, index) => {
    const contract = contractsById.get(item.contractId)!;
    const faceAmount = item.milestoneId
      ? Number(
          contract.milestones.find((m) => m.id === item.milestoneId)?.amount ??
            0,
        )
      : Number(contract.amount ?? 0);
    const alreadyInvoiced =
      invoiced.get(remainingKey(item.contractId, item.milestoneId)) ?? 0;
    const remaining = faceAmount - alreadyInvoiced;

    if (remaining <= 0.01) {
      throw new Error(
        "One of the selected lines has already been fully invoiced",
      );
    }
    if (item.amount > remaining + 0.01) {
      throw new Error(
        "A line item's amount can't exceed its remaining balance",
      );
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
      const created = await prisma.invoice.create({
        data: {
          number,
          clientId,
          bankAccountId,
          currency,
          discount,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          remindersEnabled,
          createdByUserId,
          items: { create: preparedItems },
          contracts: {
            create: contractIds.map((contractId) => ({ contractId })),
          },
        },
        include: { client: { select: { name: true } } },
      });
      await notifyInvoiceCreated(created.id);
      await logActivity(appUser, {
        action: "created",
        entityType: "invoice",
        entityId: created.id,
        summary: `Created invoice ${formatInvoiceNumber(number)} for ${created.client.name} (${formatContractAmount(total - discount, currency)})`,
        page: "invoices",
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
  const { appUser } = await requirePagePermission("invoices", "edit");
  const createdByUserId = appUser.authUserId;

  const transactionId = str(formData, "transactionId");
  const paidOnRaw = str(formData, "paidOn");
  const pkrAmountRaw = str(formData, "pkrAmount");
  // Off when the client has paid but the money hasn't reached the PKR
  // account yet — the invoice/contracts/emails still update, but no Earning
  // is booked until addInvoiceEarning is run for it later.
  const addToEarning = str(formData, "addToEarning") !== "false";

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

  const pkrAmount = addToEarning ? parsePkrAmount(invoice, pkrAmountRaw) : null;

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
    const totalBillable = contractRevenueBasis(contract);
    const thisInvoiceSum = invoice.items
      .filter((item) => item.contractId === contract.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const totalPaid =
      (alreadyPaidByContract.get(contract.id) ?? 0) + thisInvoiceSum;
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

  const earningPlan =
    pkrAmount !== null
      ? await planInvoiceEarning({
          invoice,
          completedContractIds: completedIds,
          pkrAmount,
        })
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        status: "PAID",
        paidOn,
        transactionId,
        pkrAmount,
        completedContractIds: completedIds,
      },
    });
    if (completedIds.length > 0) {
      await tx.contract.updateMany({
        where: { id: { in: completedIds } },
        data: { status: "COMPLETED" },
      });
    }
    if (partiallyPaidIds.length > 0) {
      await tx.contract.updateMany({
        where: { id: { in: partiallyPaidIds } },
        data: { status: "PARTIALLY_PAID" },
      });
    }
    if (earningPlan) {
      await writeInvoiceEarning(tx, earningPlan, {
        invoiceId: id,
        date: paidOn,
        createdByUserId,
      });
    }
  });

  await notifyInvoicePaid(id);
  await logActivity(appUser, {
    action: "marked-paid",
    entityType: "invoice",
    entityId: id,
    summary: `Marked invoice ${formatInvoiceNumber(invoice.number)} (${invoice.client.name}) as paid — txn ${transactionId}${earningPlan ? "" : " (not added to earning)"}`,
    page: "invoices",
  });

  revalidatePath("/projects/invoices");
  revalidatePath("/projects/contracts");
  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/balance-sheet");
}

/** Books the Earning for a paid invoice that was marked paid without one
 * (money not yet in the PKR account at the time) — the same figures
 * markInvoicePaid would have booked, dated when the money actually arrived. */
export async function addInvoiceEarning(id: string, formData: FormData) {
  const { appUser } = await requirePagePermission("invoices", "edit");
  const createdByUserId = appUser.authUserId;

  const receivedOnRaw = str(formData, "receivedOn");
  const pkrAmountRaw = str(formData, "pkrAmount");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      items: true,
      earning: { select: { id: true } },
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "PAID") {
    throw new Error("Only a paid invoice can be added to earning");
  }
  if (invoice.earning) {
    throw new Error("This invoice has already been added to earning");
  }

  const pkrAmount = parsePkrAmount(invoice, pkrAmountRaw);
  const receivedOn = receivedOnRaw ? new Date(receivedOnRaw) : new Date();

  const earningPlan = await planInvoiceEarning({
    invoice,
    completedContractIds: invoice.completedContractIds,
    pkrAmount,
  });

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { pkrAmount } });
    await writeInvoiceEarning(tx, earningPlan, {
      invoiceId: id,
      date: receivedOn,
      createdByUserId,
    });
  });

  await logActivity(appUser, {
    action: "added-earning",
    entityType: "invoice",
    entityId: id,
    summary: `Added invoice ${formatInvoiceNumber(invoice.number)} (${invoice.client.name}) to earning — ${formatContractAmount(pkrAmount, "PKR")} received`,
    page: "invoices",
  });

  revalidatePath("/projects/invoices");
  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/balance-sheet");
}

/** PKR actually received for an invoice — its own balance due when it's
 * billed in PKR, otherwise the admin-entered figure. */
function parsePkrAmount(
  invoice: {
    currency: string;
    discount: unknown;
    items: { amount: unknown }[];
  },
  pkrAmountRaw: string,
) {
  if (invoice.currency === "PKR") {
    return (
      invoice.items.reduce((sum, item) => sum + Number(item.amount), 0) -
      Number(invoice.discount)
    );
  }
  const pkrAmount = Number(pkrAmountRaw);
  if (!pkrAmountRaw || Number.isNaN(pkrAmount) || pkrAmount <= 0) {
    throw new Error("Enter the PKR amount received for this payment");
  }
  return pkrAmount;
}

/** Every markInvoicePaid-booked partner share for these contracts, plus a
 * guard against undoing one that already has real paperwork issued against
 * it. Called before unmarking an invoice paid / deleting a paid invoice —
 * ProjectExpense rows are never touched here, since they're booked
 * independently at entry time, not at contract completion. */
async function collectReversiblePartnerPaymentIds(contractIds: string[]) {
  if (contractIds.length === 0) return [];
  const autoPartnerPayments = await prisma.partnerPayment.findMany({
    where: { contractId: { in: contractIds }, source: "AUTO_COMPLETION" },
    select: { id: true, partnerPayslipId: true },
  });
  if (autoPartnerPayments.some((p) => p.partnerPayslipId)) {
    throw new Error(
      "A partner payslip has already been issued against this project's share — remove it before undoing this payment",
    );
  }
  return autoPartnerPayments.map((p) => p.id);
}

export async function markInvoiceUnpaid(id: string) {
  const { appUser } = await requirePagePermission("invoices", "edit");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      client: { select: { name: true } },
      contracts: { select: { contractId: true } },
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "UNPAID") return;

  const contractIds = invoice.contracts.map((c) => c.contractId);
  const partnerPaymentIds =
    await collectReversiblePartnerPaymentIds(contractIds);

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: {
        status: "UNPAID",
        paidOn: null,
        transactionId: null,
        pkrAmount: null,
        completedContractIds: [],
      },
    }),
    prisma.contract.updateMany({
      where: {
        id: { in: contractIds },
        status: { in: [...PAID_CONTRACT_STATUSES] },
      },
      data: { status: "PENDING_PAYMENT" },
    }),
    prisma.earning.deleteMany({ where: { invoiceId: id } }),
    prisma.partnerPayment.deleteMany({
      where: { id: { in: partnerPaymentIds } },
    }),
  ]);

  await logActivity(appUser, {
    action: "marked-unpaid",
    entityType: "invoice",
    entityId: id,
    summary: `Marked invoice ${formatInvoiceNumber(invoice.number)} (${invoice.client.name}) as unpaid`,
    page: "invoices",
  });

  revalidatePath("/projects/invoices");
  revalidatePath("/projects/contracts");
  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/balance-sheet");
}

export async function deleteInvoice(id: string) {
  const { appUser } = await requirePagePermission("invoices", "delete");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      client: { select: { name: true } },
      contracts: { select: { contractId: true } },
    },
  });
  if (!invoice) throw new Error("Invoice not found");

  if (invoice.status === "PAID") {
    const contractIds = invoice.contracts.map((c) => c.contractId);
    const partnerPaymentIds =
      await collectReversiblePartnerPaymentIds(contractIds);
    await prisma.$transaction([
      prisma.contract.updateMany({
        where: {
          id: { in: contractIds },
          status: { in: [...PAID_CONTRACT_STATUSES] },
        },
        data: { status: "PENDING_PAYMENT" },
      }),
      prisma.partnerPayment.deleteMany({
        where: { id: { in: partnerPaymentIds } },
      }),
      prisma.invoice.delete({ where: { id } }),
    ]);
    revalidatePath("/projects/contracts");
    revalidatePath("/account/earning");
    revalidatePath("/account/distributions");
    revalidatePath("/account/balance-sheet");
  } else {
    await prisma.invoice.delete({ where: { id } });
  }

  await logActivity(appUser, {
    action: "deleted",
    entityType: "invoice",
    entityId: id,
    summary: `Deleted ${invoice.status === "PAID" ? "paid" : "unpaid"} invoice ${formatInvoiceNumber(invoice.number)} (${invoice.client.name})`,
    page: "invoices",
  });

  revalidatePath("/projects/invoices");
}

/** Switches overdue reminders on/off for one invoice. Turning them back on
 * doesn't reset the count — an invoice that already had its reminders
 * keeps its history, so the client never gets more than the max in total. */
export async function setInvoiceReminders(id: string, enabled: boolean) {
  const { appUser } = await requirePagePermission("invoices", "edit");

  const invoice = await prisma.invoice.update({
    where: { id },
    data: { remindersEnabled: enabled },
    select: { number: true, client: { select: { name: true } } },
  });

  await logActivity(appUser, {
    action: "reminders-toggled",
    entityType: "invoice",
    entityId: id,
    summary: `Turned ${enabled ? "on" : "off"} overdue reminders for invoice ${formatInvoiceNumber(invoice.number)} (${invoice.client.name})`,
    page: "invoices",
  });

  revalidatePath("/projects/invoices");
}
