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
  isOpenEnded,
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
  notifyInvoiceReminder,
} from "@/lib/mail/notifications/invoices";
import {
  planInvoiceEarning,
  writeInvoiceEarning,
} from "@/lib/invoices/earning";
import { feesToPkr, parseFeeInputs } from "@/lib/invoices/fees";
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
    if (isOpenEnded(contract.paymentType)) {
      throw new Error(
        "Hourly and recurring contracts are invoiced from their own contract, not here",
      );
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

  // Platform commission, withdrawal fee, tax… deducted before the money
  // arrived. The PKR entered (or, for a PKR invoice, balance − fees) is
  // what actually landed, so it's already net of these.
  const balanceDue = invoiceBalanceDue(invoice);
  const fees = parseFeeInputs(str(formData, "fees"), balanceDue);

  const pkrAmount = addToEarning
    ? parsePkrAmount(invoice, pkrAmountRaw, fees.total)
    : null;
  const feesPkr =
    pkrAmount !== null
      ? feesToPkr({
          feesTotal: fees.total,
          currency: invoice.currency,
          balanceDue,
          pkrReceived: pkrAmount,
        })
      : null;

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
            deadline: true,
            nextInvoiceDate: true,
            milestones: { select: { amount: true } },
          },
        })
      : [];

  // Open-ended contracts still owing on another invoice stay "payment due".
  const openEndedIds = contracts
    .filter((c) => isOpenEnded(c.paymentType))
    .map((c) => c.id);
  const stillOwing = new Set(
    openEndedIds.length > 0
      ? (
          await prisma.invoiceItem.findMany({
            where: {
              contractId: { in: openEndedIds },
              invoice: { status: "UNPAID", id: { not: id } },
            },
            select: { contractId: true },
          })
        ).map((item) => item.contractId!)
      : [],
  );

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
  // Open-ended contracts never complete by being paid off: once nothing's
  // owed they go back to ACTIVE — or COMPLETED, for a recurring contract
  // whose end date has passed with every period invoiced.
  const settledActiveIds: string[] = [];
  const settledEndedIds: string[] = [];
  // Advance paid while a later period's invoice is already out.
  const advancePaidOwingIds: string[] = [];
  for (const contract of contracts) {
    if (isOpenEnded(contract.paymentType)) {
      if (
        contract.status === "AWAITING_ADVANCE" &&
        stillOwing.has(contract.id)
      ) {
        advancePaidOwingIds.push(contract.id);
        continue;
      }
      // Payment due, or a recurring contract's advance invoice being paid.
      if (
        !["PENDING_PAYMENT", "AWAITING_ADVANCE"].includes(contract.status) ||
        stillOwing.has(contract.id)
      )
        continue;
      const ended =
        contract.paymentType === "RECURRING" &&
        !!contract.deadline &&
        !!contract.nextInvoiceDate &&
        contract.nextInvoiceDate > contract.deadline;
      (ended ? settledEndedIds : settledActiveIds).push(contract.id);
      continue;
    }
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
          feesPkr: feesPkr ?? 0,
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
        feesAmount: fees.total,
        feesPkr,
        fees: {
          deleteMany: {},
          create: fees.lines.map((line, index) => ({
            ...line,
            sortOrder: index,
          })),
        },
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
    if (settledActiveIds.length > 0) {
      await tx.contract.updateMany({
        where: { id: { in: settledActiveIds } },
        data: { status: "ACTIVE" },
      });
    }
    if (advancePaidOwingIds.length > 0) {
      await tx.contract.updateMany({
        where: { id: { in: advancePaidOwingIds } },
        data: { status: "PENDING_PAYMENT" },
      });
    }
    if (settledEndedIds.length > 0) {
      await tx.contract.updateMany({
        where: { id: { in: settledEndedIds } },
        data: { status: "COMPLETED" },
      });
    }
    if (earningPlan) {
      await writeInvoiceEarning(tx, earningPlan, {
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
    summary: `Marked invoice ${formatInvoiceNumber(invoice.number)} (${invoice.client.name}) as paid — txn ${transactionId}${fees.total > 0 ? `, ${formatContractAmount(fees.total, invoice.currency)} in fees (${fees.lines.map((l) => l.label).join(", ")})` : ""}${earningPlan ? "" : " (not added to earning)"}`,
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

  // Fees were recorded when it was marked paid; the PKR entered now is
  // what actually arrived, already net of them.
  const feesTotal = Number(invoice.feesAmount);
  const pkrAmount = parsePkrAmount(invoice, pkrAmountRaw, feesTotal);
  const feesPkr = feesToPkr({
    feesTotal,
    currency: invoice.currency,
    balanceDue: invoiceBalanceDue(invoice),
    pkrReceived: pkrAmount,
  });
  const receivedOn = receivedOnRaw ? new Date(receivedOnRaw) : new Date();

  const earningPlan = await planInvoiceEarning({
    invoice,
    completedContractIds: invoice.completedContractIds,
    pkrAmount,
    feesPkr,
  });

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { pkrAmount, feesPkr } });
    await writeInvoiceEarning(tx, earningPlan, {
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

function invoiceBalanceDue(invoice: {
  discount: unknown;
  items: { amount: unknown }[];
}) {
  return (
    invoice.items.reduce((sum, item) => sum + Number(item.amount), 0) -
    Number(invoice.discount)
  );
}

/** PKR actually received for an invoice — its balance due less any fees
 * when it's billed in PKR, otherwise the admin-entered figure (which is
 * already what arrived after fees). */
function parsePkrAmount(
  invoice: {
    currency: string;
    discount: unknown;
    items: { amount: unknown }[];
  },
  pkrAmountRaw: string,
  feesTotal = 0,
) {
  if (invoice.currency === "PKR") {
    return invoiceBalanceDue(invoice) - feesTotal;
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
async function collectReversiblePartnerPaymentIds(
  invoiceId: string,
  contracts: { id: string; paymentType: string }[],
) {
  if (contracts.length === 0) return [];
  const fixedIds = contracts
    .filter((c) => !isOpenEnded(c.paymentType))
    .map((c) => c.id);
  const openEndedIds = contracts
    .filter((c) => isOpenEnded(c.paymentType))
    .map((c) => c.id);
  const autoPartnerPayments = await prisma.partnerPayment.findMany({
    where: {
      source: "AUTO_COMPLETION",
      OR: [
        // A fixed-price contract books its share once, on completion.
        { contractId: { in: fixedIds } },
        // An open-ended one books a share per paid invoice — only this
        // invoice's own share is undone.
        { contractId: { in: openEndedIds }, invoiceId },
      ],
    },
    select: { id: true, partnerPayslipId: true },
  });
  if (autoPartnerPayments.some((p) => p.partnerPayslipId)) {
    throw new Error(
      "A partner payslip has already been issued against this project's share — remove it before undoing this payment",
    );
  }
  return autoPartnerPayments.map((p) => p.id);
}

async function invoiceContracts(contractIds: string[]) {
  return contractIds.length > 0
    ? prisma.contract.findMany({
        where: { id: { in: contractIds } },
        select: { id: true, paymentType: true },
      })
    : [];
}

/** Once an open-ended contract has no unpaid invoice left, it's no longer
 * "payment due" — back to ACTIVE. */
async function settleOpenEndedContracts(contractIds: string[]) {
  if (contractIds.length === 0) return;
  const owing = await prisma.invoiceItem.findMany({
    where: { contractId: { in: contractIds }, invoice: { status: "UNPAID" } },
    select: { contractId: true },
  });
  const owingIds = new Set(owing.map((item) => item.contractId));
  const settled = contractIds.filter((id) => !owingIds.has(id));
  if (settled.length === 0) return;
  await prisma.contract.updateMany({
    where: { id: { in: settled }, status: "PENDING_PAYMENT" },
    data: { status: "ACTIVE" },
  });
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

  const contracts = await invoiceContracts(
    invoice.contracts.map((c) => c.contractId),
  );
  const fixedIds = contracts
    .filter((c) => !isOpenEnded(c.paymentType))
    .map((c) => c.id);
  const openEndedIds = contracts
    .filter((c) => isOpenEnded(c.paymentType))
    .map((c) => c.id);
  const partnerPaymentIds = await collectReversiblePartnerPaymentIds(
    id,
    contracts,
  );
  // A recurring contract with no other paid invoice was only ever paid its
  // advance — un-paying it puts it back to awaiting that advance.
  const recurringIds = contracts
    .filter((c) => c.paymentType === "RECURRING")
    .map((c) => c.id);
  const everPaid = new Set(
    recurringIds.length > 0
      ? (
          await prisma.invoiceItem.findMany({
            where: {
              contractId: { in: recurringIds },
              invoice: { status: "PAID", id: { not: id } },
            },
            select: { contractId: true },
          })
        ).map((item) => item.contractId!)
      : [],
  );
  const awaitingAdvanceIds = recurringIds.filter((cid) => !everPaid.has(cid));

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: {
        status: "UNPAID",
        paidOn: null,
        transactionId: null,
        pkrAmount: null,
        feesAmount: 0,
        feesPkr: null,
        fees: { deleteMany: {} },
        completedContractIds: [],
      },
    }),
    prisma.contract.updateMany({
      where: {
        id: { in: fixedIds },
        status: { in: [...PAID_CONTRACT_STATUSES] },
      },
      data: { status: "PENDING_PAYMENT" },
    }),
    // An open-ended contract owes this invoice again.
    prisma.contract.updateMany({
      where: {
        id: {
          in: openEndedIds.filter((cid) => !awaitingAdvanceIds.includes(cid)),
        },
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      data: { status: "PENDING_PAYMENT" },
    }),
    prisma.contract.updateMany({
      where: {
        id: { in: awaitingAdvanceIds },
        status: { in: ["ACTIVE", "COMPLETED", "PENDING_PAYMENT"] },
      },
      data: { status: "AWAITING_ADVANCE" },
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
  revalidatePath("/projects/recurring");
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

  const contracts = await invoiceContracts(
    invoice.contracts.map((c) => c.contractId),
  );
  const fixedIds = contracts
    .filter((c) => !isOpenEnded(c.paymentType))
    .map((c) => c.id);
  const openEndedIds = contracts
    .filter((c) => isOpenEnded(c.paymentType))
    .map((c) => c.id);

  if (invoice.status === "PAID") {
    const partnerPaymentIds = await collectReversiblePartnerPaymentIds(
      id,
      contracts,
    );
    await prisma.$transaction([
      prisma.contract.updateMany({
        where: {
          id: { in: fixedIds },
          status: { in: [...PAID_CONTRACT_STATUSES] },
        },
        data: { status: "PENDING_PAYMENT" },
      }),
      prisma.partnerPayment.deleteMany({
        where: { id: { in: partnerPaymentIds } },
      }),
      prisma.invoice.delete({ where: { id } }),
    ]);
    revalidatePath("/account/earning");
    revalidatePath("/account/distributions");
    revalidatePath("/account/balance-sheet");
  } else {
    // Deleting an invoice frees any hours it billed (ContractHourLog's
    // invoiceItemId is set null) so they can be invoiced again.
    await prisma.invoice.delete({ where: { id } });
  }
  await settleOpenEndedContracts(openEndedIds);

  await logActivity(appUser, {
    action: "deleted",
    entityType: "invoice",
    entityId: id,
    summary: `Deleted ${invoice.status === "PAID" ? "paid" : "unpaid"} invoice ${formatInvoiceNumber(invoice.number)} (${invoice.client.name})`,
    page: "invoices",
  });

  revalidatePath("/projects/invoices");
  revalidatePath("/projects/contracts");
  revalidatePath("/projects/recurring");
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

/** Sends an overdue reminder for one invoice right now, from the invoice's
 * actions menu — works whether or not automatic reminders are switched on.
 * It counts toward the automatic schedule (reminderCount/lastReminderAt),
 * so the daily run won't send a second one a day later. */
export async function sendInvoiceReminderNow(id: string) {
  const { appUser } = await requirePagePermission("invoices", "edit");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      dueDate: true,
      reminderCount: true,
      client: {
        select: { name: true, email: true, emailNotificationsEnabled: true },
      },
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "UNPAID") {
    throw new Error("This invoice is already paid");
  }

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (invoice.dueDate >= today) {
    throw new Error(
      "This invoice isn't overdue yet — reminders can only be sent after its due date",
    );
  }
  if (!invoice.client.email) {
    throw new Error("This client has no email address on file");
  }
  if (!invoice.client.emailNotificationsEnabled) {
    throw new Error(
      "This client has email notifications switched off — turn them on in the client's profile to send a reminder",
    );
  }

  const daysOverdue = Math.max(
    1,
    Math.round(
      (today.getTime() - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );
  // Throws if the email couldn't be sent, so nothing is recorded then.
  await notifyInvoiceReminder(id, daysOverdue);

  await prisma.invoice.update({
    where: { id },
    data: { reminderCount: { increment: 1 }, lastReminderAt: now },
  });
  await logActivity(appUser, {
    action: "reminder-sent",
    entityType: "invoice",
    entityId: id,
    summary: `Sent an overdue reminder for invoice ${formatInvoiceNumber(invoice.number)} to ${invoice.client.name} (${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue)`,
    page: "invoices",
  });

  revalidatePath("/projects/invoices");
  return { sentTo: invoice.client.email };
}
