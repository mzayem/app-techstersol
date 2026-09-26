"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";
import { formatContractAmount } from "@/lib/contracts/constants";

function describe(e: { name: string; amount: unknown }, projectName: string) {
  return `"${e.name}" (${formatContractAmount(Number(e.amount), "PKR")}) on contract "${projectName}"`;
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
    throw new Error("Enter a valid expense amount (PKR)");
  }

  return { date: new Date(date), name, amount };
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

  const created = await prisma.projectExpense.create({
    data: {
      contractId,
      date,
      name,
      amount,
      createdByUserId,
      ledgerEntries: {
        create: { type: "EXPENSE", name, date, debit: amount },
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
  revalidatePath("/account/balance-sheet");

  return {
    id: created.id,
    date: created.date,
    name: created.name,
    amount: Number(created.amount),
  };
}

export async function updateProjectExpense(id: string, formData: FormData) {
  const { appUser } = await requirePagePermission("contracts", "edit");
  const { date, name, amount } = readExpenseFields(formData);

  const updated = await prisma.projectExpense.update({
    where: { id },
    data: {
      date,
      name,
      amount,
      // Same replace-the-ledger-row pattern as updateExpense — delete and
      // recreate rather than patch in place, so the ledger entry always
      // mirrors the current name/date/amount exactly.
      ledgerEntries: {
        deleteMany: {},
        create: { type: "EXPENSE", name, date, debit: amount },
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
  revalidatePath("/account/balance-sheet");

  return {
    id: updated.id,
    date: updated.date,
    name: updated.name,
    amount: Number(updated.amount),
  };
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
  revalidatePath("/account/balance-sheet");
}
