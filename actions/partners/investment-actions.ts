"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { InvestmentMethod } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { notifyPartnerInvestmentRecorded } from "@/lib/mail/notifications/partners";
import {
  PARTNER_INVESTMENT_NUMBER_START,
  formatPartnerInvestmentNumber,
} from "@/lib/partners/investment-constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import { logActivity } from "@/lib/activity/log";

function pkr(amount: unknown) {
  return formatContractAmount(Number(amount), "PKR");
}
import { checkPermission, requirePagePermission } from "@/lib/rbac/permissions";
import { getPartnerInvestmentBalance } from "@/actions/partners/investment-queries";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const INVESTMENT_METHODS: InvestmentMethod[] = [
  "PENDING_PAYMENT",
  "CASH",
  "ONLINE",
];

function revalidateInvestmentPaths() {
  revalidatePath("/partners/investments");
  revalidatePath("/partner-portal/investments");
}

export async function createPartnerInvestment(formData: FormData) {
  const { appUser } = await requirePagePermission(
    "partner-investments",
    "create",
  );
  const createdByUserId = appUser.authUserId;

  const partnerId = str(formData, "partnerId");
  const date = str(formData, "date");
  const methodRaw = str(formData, "method");
  const amountRaw = str(formData, "amount");
  const contractId = str(formData, "contractId");
  const transactionId = str(formData, "transactionId");
  const note = str(formData, "note");

  if (!partnerId || !date) {
    throw new Error("Partner and date are required");
  }
  if (!INVESTMENT_METHODS.includes(methodRaw as InvestmentMethod)) {
    throw new Error("Select how this investment was funded");
  }
  const method = methodRaw as InvestmentMethod;

  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });
  if (!partner) throw new Error("Selected partner no longer exists");

  let pendingPayment: { id: string } | null = null;
  if (method === "PENDING_PAYMENT") {
    if (!contractId) {
      throw new Error("Select which pending payout to convert");
    }
    pendingPayment = await prisma.partnerPayment.findFirst({
      where: {
        contractId,
        partnerId,
        source: "AUTO_COMPLETION",
        partnerPayslipId: null,
        partnerInvestmentId: null,
      },
      select: { id: true },
    });
    if (!pendingPayment) {
      throw new Error("That pending payout is no longer available to convert");
    }
  }

  const dateObj = new Date(date);

  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.partnerInvestment.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = last ? last.number + 1 : PARTNER_INVESTMENT_NUMBER_START;

    try {
      const created = await prisma.partnerInvestment.create({
        data: {
          number,
          partnerId,
          date: dateObj,
          amount,
          method,
          transactionId: transactionId || null,
          note: note || null,
          createdByUserId,
          ...(pendingPayment
            ? { partnerPayment: { connect: { id: pendingPayment.id } } }
            : {}),
        },
      });
      await notifyPartnerInvestmentRecorded(created.id);
      await logActivity(appUser, {
        action: "created",
        entityType: "partner-investment",
        entityId: created.id,
        summary: `Recorded investment ${formatPartnerInvestmentNumber(number)} from ${partner.name} (${pkr(amount)})`,
        page: "partner-investments",
      });
      revalidateInvestmentPaths();
      return;
    } catch (e) {
      const isNumberConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isNumberConflict || attempt === 2) throw e;
    }
  }
}

export async function deletePartnerInvestment(id: string) {
  const { appUser } = await requirePagePermission(
    "partner-investments",
    "delete",
  );

  const linkedPayment = await prisma.partnerPayment.findUnique({
    where: { partnerInvestmentId: id },
    select: { id: true },
  });

  const deleted = await prisma.$transaction(async (tx) => {
    // The underlying PartnerPayment (when this investment came from a
    // converted pending payout) is real accrued money — it survives and
    // reverts to unlinked/pending, re-convertible or payable later, same
    // as deletePartnerPayslip does for an AUTO_COMPLETION payment.
    if (linkedPayment) {
      await tx.partnerPayment.update({
        where: { id: linkedPayment.id },
        data: { partnerInvestmentId: null },
      });
    }
    return tx.partnerInvestment.delete({
      where: { id },
      include: { partner: { select: { name: true } } },
    });
  });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "partner-investment",
    entityId: id,
    summary: `Deleted investment ${formatPartnerInvestmentNumber(deleted.number)} from ${deleted.partner.name} (${pkr(deleted.amount)})`,
    page: "partner-investments",
  });

  revalidateInvestmentPaths();
}

export async function createPartnerInvestmentSpend(formData: FormData) {
  const { appUser } = await requirePagePermission(
    "partner-investments",
    "create",
  );
  const createdByUserId = appUser.authUserId;

  const partnerId = str(formData, "partnerId");
  const date = str(formData, "date");
  const category = str(formData, "category");
  const amountRaw = str(formData, "amount");
  const note = str(formData, "note");
  // "Add my share": part of the total is paid by the company instead of the
  // partner's investment, and is booked as a company Investment expense.
  const shareEnabled = str(formData, "companyShareEnabled") === "true";
  const companyShareRaw = str(formData, "companyShare");

  if (!partnerId || !date || !category) {
    throw new Error("Partner, date, and category are required");
  }
  const totalAmount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(totalAmount) || totalAmount <= 0) {
    throw new Error("Enter a valid amount");
  }

  let companyShare = 0;
  if (shareEnabled) {
    companyShare = Number(companyShareRaw);
    if (!companyShareRaw || Number.isNaN(companyShare) || companyShare <= 0) {
      throw new Error("Enter your share of this spend");
    }
    if (companyShare >= totalAmount) {
      throw new Error(
        "Your share must be less than the total — log it as a company expense instead if you're paying all of it",
      );
    }
    if (!checkPermission(appUser, "expenses", "create")) {
      throw new Error(
        "Adding your share creates a company expense, which your role isn't allowed to create",
      );
    }
  }
  // What comes out of the partner's investment.
  const amount = Math.round((totalAmount - companyShare) * 100) / 100;

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });
  if (!partner) throw new Error("Selected partner no longer exists");

  const balance = await getPartnerInvestmentBalance(partnerId);
  if (amount > balance.available) {
    throw new Error(
      `This exceeds ${partner.name}'s available investment balance (${balance.available.toLocaleString()} PKR available)`,
    );
  }

  const dateObj = new Date(date);
  const spend = await prisma.$transaction(async (tx) => {
    const companyExpense =
      companyShare > 0
        ? await tx.expense.create({
            data: {
              date: dateObj,
              category: "INVESTMENT",
              name: `${category} — my share (joint spend with ${partner.name})`,
              amount: companyShare,
              createdByUserId,
              ledgerEntries: {
                create: {
                  type: "EXPENSE",
                  name: `${category} — my share (joint spend with ${partner.name})`,
                  date: dateObj,
                  debit: companyShare,
                },
              },
            },
            select: { id: true },
          })
        : null;
    return tx.partnerInvestmentSpend.create({
      data: {
        partnerId,
        date: dateObj,
        amount,
        category,
        note: note || null,
        companyExpenseId: companyExpense?.id ?? null,
        createdByUserId,
      },
    });
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "partner-investment",
    entityId: spend.id,
    summary:
      companyShare > 0
        ? `Spent ${pkr(totalAmount)} on "${category}" — ${pkr(amount)} from ${partner.name}'s investment, ${pkr(companyShare)} my share (added to expenses as Investment)`
        : `Spent ${pkr(amount)} of ${partner.name}'s investment on "${category}"`,
    page: "partner-investments",
  });

  revalidateInvestmentPaths();
  if (companyShare > 0) {
    revalidatePath("/account/expenses");
    revalidatePath("/account/distributions");
    revalidatePath("/account/balance-sheet");
  }
}

export async function deletePartnerInvestmentSpend(id: string) {
  const { appUser } = await requirePagePermission(
    "partner-investments",
    "delete",
  );

  const spend = await prisma.$transaction(async (tx) => {
    const deleted = await tx.partnerInvestmentSpend.delete({
      where: { id },
      include: { partner: { select: { name: true } } },
    });
    if (deleted.companyExpenseId) {
      // Its ledger row cascades with it.
      await tx.expense.deleteMany({ where: { id: deleted.companyExpenseId } });
    }
    return deleted;
  });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "partner-investment",
    entityId: id,
    summary: `Deleted a ${pkr(spend.amount)} "${spend.category}" spend from ${spend.partner.name}'s investment${spend.companyExpenseId ? " (and my share's expense)" : ""}`,
    page: "partner-investments",
  });

  revalidateInvestmentPaths();
  if (spend.companyExpenseId) {
    revalidatePath("/account/expenses");
    revalidatePath("/account/distributions");
    revalidatePath("/account/balance-sheet");
  }
}
