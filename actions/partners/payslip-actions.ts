"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  PARTNER_PAYSLIP_NUMBER_START,
  formatPartnerPayslipNumber,
} from "@/lib/partners/constants";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { notifyPartnerPayslipIssued } from "@/lib/mail/notifications/partners";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPartnerPayslip(formData: FormData) {
  const { appUser } = await requirePagePermission("partner-payslips", "create");
  const createdByUserId = appUser.authUserId;

  const partnerId = str(formData, "partnerId");
  const contractId = str(formData, "contractId");
  const periodStart = str(formData, "periodStart");
  const periodEnd = str(formData, "periodEnd");
  const issueDate = str(formData, "issueDate");
  const amountRaw = str(formData, "amount");
  const note = str(formData, "note");

  if (!partnerId || !periodStart || !periodEnd || !issueDate) {
    throw new Error("Partner, period, and issue date are required");
  }
  if (new Date(periodStart) > new Date(periodEnd)) {
    throw new Error("Period start can't be after period end");
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

  // If the chosen contract already completed, markInvoicePaid already
  // booked its profit-share as an AUTO_COMPLETION PartnerPayment the
  // moment the contract finished — this payslip is just the paperwork for
  // money already accrued, so it gets linked rather than double-booked.
  // No such row (no contract link, or the contract hasn't completed yet —
  // an advance) means this payment hasn't hit the ledger anywhere yet, so
  // it's recorded as its own outgoing MANUAL PartnerPayment.
  const existingPayment = contractId
    ? await prisma.partnerPayment.findFirst({
        where: {
          contractId,
          source: "AUTO_COMPLETION",
          partnerPayslipId: null,
        },
        select: { id: true },
      })
    : null;

  const issueDateObj = new Date(issueDate);

  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.partnerPayslip.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = last ? last.number + 1 : PARTNER_PAYSLIP_NUMBER_START;
    const label = `${partner.name} — Payslip ${formatPartnerPayslipNumber(number)}`;

    try {
      const created = await prisma.$transaction(async (tx) => {
        const payslip = await tx.partnerPayslip.create({
          data: {
            number,
            partnerId,
            contractId: contractId || null,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            issueDate: issueDateObj,
            amount,
            note: note || null,
            createdByUserId,
            ...(existingPayment
              ? { partnerPayment: { connect: { id: existingPayment.id } } }
              : {
                  partnerPayment: {
                    create: {
                      date: issueDateObj,
                      name: label,
                      partnerId,
                      contractId: contractId || null,
                      amount,
                      source: "MANUAL",
                      createdByUserId,
                      ledgerEntries: {
                        create: {
                          type: "PARTNER_PAYMENT",
                          name: label,
                          date: issueDateObj,
                          debit: amount,
                        },
                      },
                    },
                  },
                }),
          },
        });

        // The AUTO_COMPLETION share was booked (accrued) at contract
        // completion with no ledger entry of its own yet — issuing the
        // payslip is the actual payout event, so the debit hits the ledger
        // now, for whatever amount this payslip actually states (which may
        // differ slightly from the original accrual if it was hand-edited).
        if (existingPayment) {
          await tx.ledgerEntry.create({
            data: {
              type: "PARTNER_PAYMENT",
              name: label,
              date: issueDateObj,
              debit: amount,
              partnerPaymentId: existingPayment.id,
            },
          });
        }

        return payslip;
      });
      await notifyPartnerPayslipIssued(created.id);
      revalidatePath("/partners/payslips");
      revalidatePath("/account/balance-sheet");
      revalidatePath("/");
      return;
    } catch (e) {
      const isNumberConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isNumberConflict || attempt === 2) throw e;
    }
  }
}

export async function deletePartnerPayslip(id: string) {
  await requirePagePermission("partner-payslips", "delete");

  const payment = await prisma.partnerPayment.findUnique({
    where: { partnerPayslipId: id },
    select: { id: true, source: true },
  });

  if (payment && payment.source === "MANUAL") {
    // The linked PartnerPayment is deleted explicitly rather than left to
    // dangle via its onDelete: SetNull — deleting a manually-booked
    // payslip should remove its outgoing payment and ledger entry too, not
    // just the paperwork (mirrors deletePayslip's TeamPayment cleanup).
    await prisma.$transaction([
      prisma.partnerPayment.delete({ where: { id: payment.id } }),
      prisma.partnerPayslip.delete({ where: { id } }),
    ]);
  } else if (payment) {
    // AUTO_COMPLETION: the PartnerPayment itself is real accrued money
    // already booked at contract completion, so it survives — only the
    // paperwork and the ledger debit its issuance created go away (the
    // payment reverts to unlinked/pending, re-issuable later), unlinking
    // via onDelete: SetNull.
    await prisma.$transaction([
      prisma.ledgerEntry.deleteMany({
        where: { partnerPaymentId: payment.id },
      }),
      prisma.partnerPayslip.delete({ where: { id } }),
    ]);
  } else {
    await prisma.partnerPayslip.delete({ where: { id } });
  }

  revalidatePath("/partners/payslips");
  revalidatePath("/account/balance-sheet");
  revalidatePath("/");
}
