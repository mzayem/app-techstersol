"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  EXPENSE_CATEGORIES,
  REFERENCE_CURRENCIES,
  type ExpenseCategory,
  type ReferenceCurrency,
} from "@/lib/finance/constants";

async function requireUserId() {
  const { data } = await auth.getSession();
  if (!data?.user) throw new Error("Not signed in");
  return data.user.id;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function decimalOrUndefined(value: string) {
  return value === "" ? undefined : value;
}

export async function createEarning(formData: FormData) {
  const createdByUserId = await requireUserId();

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

  await prisma.earning.create({
    data: {
      date: new Date(date),
      name,
      amount,
      teamPay,
      referenceAmount,
      referenceCurrency,
      createdByUserId,
    },
  });

  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/expenses");
  revalidatePath("/account/donations");
}

export async function updateEarning(id: string, formData: FormData) {
  await requireUserId();

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

  await prisma.earning.update({
    where: { id },
    data: {
      date: new Date(date),
      name,
      amount,
      teamPay,
      referenceAmount: referenceAmount ?? null,
      referenceCurrency: referenceCurrency ?? null,
    },
  });

  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/expenses");
  revalidatePath("/account/donations");
}

export async function deleteEarning(id: string) {
  await requireUserId();

  await prisma.earning.delete({ where: { id } });

  revalidatePath("/account/earning");
  revalidatePath("/account/distributions");
  revalidatePath("/account/expenses");
  revalidatePath("/account/donations");
}

export async function createExpense(formData: FormData) {
  const createdByUserId = await requireUserId();

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

  await prisma.expense.create({
    data: {
      date: new Date(date),
      category: categoryRaw as ExpenseCategory,
      name,
      amount,
      createdByUserId,
    },
  });

  revalidatePath("/account/expenses");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/donations");
}

export async function updateExpense(id: string, formData: FormData) {
  await requireUserId();

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

  await prisma.expense.update({
    where: { id },
    data: {
      date: new Date(date),
      category: categoryRaw as ExpenseCategory,
      name,
      amount,
    },
  });

  revalidatePath("/account/expenses");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/donations");
}

export async function deleteExpense(id: string) {
  await requireUserId();

  await prisma.expense.delete({ where: { id } });

  revalidatePath("/account/expenses");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/donations");
}

export async function createDonation(formData: FormData) {
  const createdByUserId = await requireUserId();

  const date = str(formData, "date");
  const name = str(formData, "name");
  const amount = str(formData, "amount");

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }

  await prisma.donation.create({
    data: {
      date: new Date(date),
      name,
      amount,
      createdByUserId,
    },
  });

  revalidatePath("/account/donations");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/expenses");
}

export async function updateDonation(id: string, formData: FormData) {
  await requireUserId();

  const date = str(formData, "date");
  const name = str(formData, "name");
  const amount = str(formData, "amount");

  if (!date || !name || !amount) {
    throw new Error("Date, name, and amount are required");
  }

  await prisma.donation.update({
    where: { id },
    data: {
      date: new Date(date),
      name,
      amount,
    },
  });

  revalidatePath("/account/donations");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/expenses");
}

export async function deleteDonation(id: string) {
  await requireUserId();

  await prisma.donation.delete({ where: { id } });

  revalidatePath("/account/donations");
  revalidatePath("/account/distributions");
  revalidatePath("/account/earning");
  revalidatePath("/account/expenses");
}
