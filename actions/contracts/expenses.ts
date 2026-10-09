"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import { getRatesToPkr } from "@/lib/fx/rates";

function describe(
  e: { name: string; amount: unknown; currency: string },
  projectName: string,
) {
  return `"${e.name}" (${formatContractAmount(Number(e.amount), e.currency)}) on contract "${projectName}"`;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readExpenseFields(formData: FormData) {
  const date = str(formData, "date");
  const name = str(formData, "name");
  const amountRaw = str(formData, "amount");

  if (!date || !name) {
    throw new Error("Date and name are required");
  }
  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error("Enter a valid expense amount");
  }

  return { date: new Date(date), name, amount };
}

/** An expense is entered in its contract's currency; the PKR equivalent
 * (at today's FX rate) is stored alongside it for the ledger, net earning
 * and partner profit split, which are all kept in PKR. */
async function inContractCurrency(contractId: string, amount: number) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { currency: true },
  });
  if (!contract) throw new Error("Contract not found");
  const currency = contract.currency as PaymentCurrency;
  const rate = currency === "PKR" ? 1 : (await getRatesToPkr())[currency];
  return {
    currency,
    pkrAmount: Math.round(amount * rate * 100) / 100,
  };
}

function toRow(e: {
  id: string;
  date: Date;
  name: string;
  amount: unknown;
  currency: string;
  pkrAmount: unknown;
}) {
  return {
    id: e.id,
    date: e.date,
    name: e.name,
    amount: Number(e.amount),
    currency: e.currency as PaymentCurrency,
    pkrAmount: Number(e.pkrAmount),
  };
}

/** Project-level expenses are booked to the ledger immediately at entry
 * time — independent of the parent contract's status or invoice payment —
 * unlike teamPay/partner-share, which only book once at contract
 * completion (see markInvoicePaid). */
export async function createProjectExpense(
  contractId: string,
  formData: FormData,
) {
  const { appUser } = await requirePagePermission("contracts", "create");
  const createdByUserId = appUser.authUserId;
  const { date, name, amount } = readExpenseFields(formData);
  const { currency, pkrAmount } = await inContractCurrency(contractId, amount);

  const created = await prisma.projectExpense.create({
    data: {
      contractId,
      date,
      name,
      amount,
      currency,
      pkrAmount,
      createdByUserId,
      ledgerEntries: {
        create: { type: "EXPENSE", name, date, debit: pkrAmount },
      },
    },
    include: { contract: { select: { projectName: true } } },
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "project-expense",
    entityId: created.id,
    summary: `Added project expense ${describe(created, created.contract.projectName)}`,
    page: "contracts",
  });

  revalidatePath("/projects/contracts");
  revalidatePath("/projects/recurring");
  revalidatePath("/account/balance-sheet");

  return toRow(created);
}

export async function updateProjectExpense(id: string, formData: FormData) {
  const { appUser } = await requirePagePermission("contracts", "edit");
  const { date, name, amount } = readExpenseFields(formData);

  const existing = await prisma.projectExpense.findUnique({
    where: { id },
    select: { contractId: true },
  });
  if (!existing) throw new Error("Expense not found");
  const { currency, pkrAmount } = await inContractCurrency(
    existing.contractId,
    amount,
  );

  const updated = await prisma.projectExpense.update({
    where: { id },
    data: {
      date,
      name,
      amount,
      currency,
      pkrAmount,
      // Same replace-the-ledger-row pattern as updateExpense — delete and
      // recreate rather than patch in place, so the ledger entry always
      // mirrors the current name/date/amount exactly.
      ledgerEntries: {
        deleteMany: {},
        create: { type: "EXPENSE", name, date, debit: pkrAmount },
      },
    },
    include: { contract: { select: { projectName: true } } },
  });

  await logActivity(appUser, {
    action: "updated",
    entityType: "project-expense",
    entityId: id,
    summary: `Edited project expense ${describe(updated, updated.contract.projectName)}`,
    page: "contracts",
  });

  revalidatePath("/projects/contracts");
  revalidatePath("/projects/recurring");
  revalidatePath("/account/balance-sheet");

  return toRow(updated);
}

export async function deleteProjectExpense(id: string) {
  const { appUser } = await requirePagePermission("contracts", "delete");

  // onDelete: Cascade on LedgerEntry.projectExpenseId cleans up the
  // matching ledger row automatically.
  const deleted = await prisma.projectExpense.delete({
    where: { id },
    include: { contract: { select: { projectName: true } } },
  });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "project-expense",
    entityId: id,
    summary: `Deleted project expense ${describe(deleted, deleted.contract.projectName)}`,
    page: "contracts",
  });

  revalidatePath("/projects/contracts");
  revalidatePath("/projects/recurring");
  revalidatePath("/account/balance-sheet");
}
