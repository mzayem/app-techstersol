"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { InvestmentMethod } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { PARTNER_INVESTMENT_NUMBER_START } from "@/lib/partners/investment-constants";
import { requirePagePermission } from "@/lib/rbac/permissions";
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
      throw new Error(
        "That pending payout is no longer available to convert",
      );
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
      await prisma.partnerInvestment.create({
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
  await requirePagePermission("partner-investments", "delete");

  const linkedPayment = await prisma.partnerPayment.findUnique({
    where: { partnerInvestmentId: id },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
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
    await tx.partnerInvestment.delete({ where: { id } });
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

  if (!partnerId || !date || !category) {
    throw new Error("Partner, date, and category are required");
  }
  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error("Enter a valid amount");
  }

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

  await prisma.partnerInvestmentSpend.create({
    data: {
      partnerId,
      date: new Date(date),
      amount,
      category,
      note: note || null,
      createdByUserId,
    },
  });

  revalidateInvestmentPaths();
}

export async function deletePartnerInvestmentSpend(id: string) {
  await requirePagePermission("partner-investments", "delete");

  await prisma.partnerInvestmentSpend.delete({ where: { id } });

  revalidateInvestmentPaths();
}
