"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  EXPENSE_CATEGORIES,
  REFERENCE_CURRENCIES,
  type ExpenseCategory,
  type ReferenceCurrency,
} from "@/lib/finance/constants";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";
import { formatContractAmount } from "@/lib/contracts/constants";

function pkr(amount: string | number) {
  return formatContractAmount(Number(amount), "PKR");
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function decimalOrUndefined(value: string) {
  return value === "" ? undefined : value;
}

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
function earningLedgerEntries(
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

export async function createEarning(formData: FormData) {
  const { appUser } = await requirePagePermission("earning", "create");
  const createdByUserId = appUser.authUserId;

  const date = str(formData, "date");
  const name = str(formData, "name");
  const amount = str(formData, "amount");
  const teamPay = str(formData, "teamPay") || "0";
  const referenceAmount = decimalOrUndefined(str(formData, "referenceAmount"));
  const referenceCurrencyRaw = str(formData, "referenceCurrency");
  const referenceCurrency = REFERENCE_CURRENCIES.includes(
    referenceCurrencyRaw as ReferenceCurrency,
  )
    ? (referenceCurrencyRaw as ReferenceCurrency)
    : undefined;

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }

  const dateObj = new Date(date);

  const earning = await prisma.earning.create({
    data: {
      date: dateObj,
      name,
      amount,
      teamPay,
      referenceAmount,
      referenceCurrency,
      createdByUserId,
      ledgerEntries: {
        create: earningLedgerEntries(name, dateObj, amount, teamPay),
      },
    },
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "earning",
    entityId: earning.id,
    summary: `Added earning "${name}" (${pkr(amount)})`,
    page: "earning",
  });

  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/expenses");
  revalidatePath("/account/donations");
  revalidatePath("/account/balance-sheet");
}

export async function updateEarning(id: string, formData: FormData) {
  const { appUser } = await requirePagePermission("earning", "edit");

  const date = str(formData, "date");
  const name = str(formData, "name");
  const amount = str(formData, "amount");
  const teamPay = str(formData, "teamPay") || "0";
  const referenceAmount = decimalOrUndefined(str(formData, "referenceAmount"));
  const referenceCurrencyRaw = str(formData, "referenceCurrency");
  const referenceCurrency = REFERENCE_CURRENCIES.includes(
    referenceCurrencyRaw as ReferenceCurrency,
  )
    ? (referenceCurrencyRaw as ReferenceCurrency)
    : undefined;

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }

  const dateObj = new Date(date);

  await prisma.earning.update({
    where: { id },
    data: {
      date: dateObj,
      name,
      amount,
      teamPay,
      referenceAmount: referenceAmount ?? null,
      referenceCurrency: referenceCurrency ?? null,
      ledgerEntries: {
        deleteMany: {},
        create: earningLedgerEntries(name, dateObj, amount, teamPay),
      },
    },
  });

  await logActivity(appUser, {
    action: "updated",
    entityType: "earning",
    entityId: id,
    summary: `Edited earning "${name}" (${pkr(amount)})`,
    page: "earning",
  });

  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/expenses");
  revalidatePath("/account/donations");
  revalidatePath("/account/balance-sheet");
}

export async function deleteEarning(id: string) {
  const { appUser } = await requirePagePermission("earning", "delete");

  const earning = await prisma.earning.delete({ where: { id } });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "earning",
    entityId: id,
    summary: `Deleted earning "${earning.name}" (${pkr(earning.amount.toString())})`,
    page: "earning",
  });

  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/expenses");
  revalidatePath("/account/donations");
  revalidatePath("/account/balance-sheet");
}

export async function createExpense(formData: FormData) {
  const { appUser } = await requirePagePermission("expenses", "create");
  const createdByUserId = appUser.authUserId;

  const date = str(formData, "date");
  const categoryRaw = str(formData, "category");
  const name = str(formData, "name");
  const amount = str(formData, "amount");

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }
  if (!EXPENSE_CATEGORIES.includes(categoryRaw as ExpenseCategory)) {
    throw new Error("Invalid expense category");
  }

  const dateObj = new Date(date);

  const expense = await prisma.expense.create({
    data: {
      date: dateObj,
      category: categoryRaw as ExpenseCategory,
      name,
      amount,
      createdByUserId,
      ledgerEntries: {
        create: { type: "EXPENSE", name, date: dateObj, debit: amount },
      },
    },
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "expense",
    entityId: expense.id,
    summary: `Added expense "${name}" (${pkr(amount)})`,
    page: "expenses",
  });

  revalidatePath("/account/expenses");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/donations");
  revalidatePath("/account/balance-sheet");
}

export async function updateExpense(id: string, formData: FormData) {
  const { appUser } = await requirePagePermission("expenses", "edit");

  const date = str(formData, "date");
  const categoryRaw = str(formData, "category");
  const name = str(formData, "name");
  const amount = str(formData, "amount");

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }
  if (!EXPENSE_CATEGORIES.includes(categoryRaw as ExpenseCategory)) {
    throw new Error("Invalid expense category");
  }

  const dateObj = new Date(date);

  await prisma.expense.update({
    where: { id },
    data: {
      date: dateObj,
      category: categoryRaw as ExpenseCategory,
      name,
      amount,
      ledgerEntries: {
        deleteMany: {},
        create: { type: "EXPENSE", name, date: dateObj, debit: amount },
      },
    },
  });

  await logActivity(appUser, {
    action: "updated",
    entityType: "expense",
    entityId: id,
    summary: `Edited expense "${name}" (${pkr(amount)})`,
    page: "expenses",
  });

  revalidatePath("/account/expenses");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/donations");
  revalidatePath("/account/balance-sheet");
}

export async function deleteExpense(id: string) {
  const { appUser } = await requirePagePermission("expenses", "delete");

  const expense = await prisma.expense.delete({ where: { id } });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "expense",
    entityId: id,
    summary: `Deleted expense "${expense.name}" (${pkr(expense.amount.toString())})`,
    page: "expenses",
  });

  revalidatePath("/account/expenses");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/donations");
  revalidatePath("/account/balance-sheet");
}

export async function createDonation(formData: FormData) {
  const { appUser } = await requirePagePermission("donations", "create");
  const createdByUserId = appUser.authUserId;

  const date = str(formData, "date");
  const name = str(formData, "name");
  const amount = str(formData, "amount");

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }

  const dateObj = new Date(date);

  const donation = await prisma.donation.create({
    data: {
      date: dateObj,
      name,
      amount,
      createdByUserId,
      ledgerEntries: {
        create: { type: "DONATION", name, date: dateObj, debit: amount },
      },
    },
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "donation",
    entityId: donation.id,
    summary: `Added donation "${name}" (${pkr(amount)})`,
    page: "donations",
  });

  revalidatePath("/account/donations");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/expenses");
  revalidatePath("/account/balance-sheet");
}

export async function updateDonation(id: string, formData: FormData) {
  const { appUser } = await requirePagePermission("donations", "edit");

  const date = str(formData, "date");
  const name = str(formData, "name");
  const amount = str(formData, "amount");

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }

  const dateObj = new Date(date);

  await prisma.donation.update({
    where: { id },
    data: {
      date: dateObj,
      name,
      amount,
      ledgerEntries: {
        deleteMany: {},
        create: { type: "DONATION", name, date: dateObj, debit: amount },
      },
    },
  });

  await logActivity(appUser, {
    action: "updated",
    entityType: "donation",
    entityId: id,
    summary: `Edited donation "${name}" (${pkr(amount)})`,
    page: "donations",
  });

  revalidatePath("/account/donations");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/expenses");
  revalidatePath("/account/balance-sheet");
}

export async function deleteDonation(id: string) {
  const { appUser } = await requirePagePermission("donations", "delete");

  const donation = await prisma.donation.delete({ where: { id } });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "donation",
    entityId: id,
    summary: `Deleted donation "${donation.name}" (${pkr(donation.amount.toString())})`,
    page: "donations",
  });

  revalidatePath("/account/donations");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/expenses");
  revalidatePath("/account/balance-sheet");
}
