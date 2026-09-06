"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { PAYSLIP_NUMBER_START } from "@/lib/team/constants";

async function requireUserId() {
  const { data } = await auth.getSession();
  if (!data?.user) throw new Error("Not signed in");
  return data.user.id;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPayslip(formData: FormData) {
  const createdByUserId = await requireUserId();

  const teamMemberId = str(formData, "teamMemberId");
  const contractId = str(formData, "contractId");
  const periodStart = str(formData, "periodStart");
  const periodEnd = str(formData, "periodEnd");
  const issueDate = str(formData, "issueDate");
  const amountRaw = str(formData, "amount");
  const note = str(formData, "note");

  if (!teamMemberId || !periodStart || !periodEnd || !issueDate) {
    throw new Error("Team member, period, and issue date are required");
  }
  if (new Date(periodStart) > new Date(periodEnd)) {
    throw new Error("Period start can't be after period end");
  }
  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
    select: { id: true, name: true },
  });
  if (!teamMember) throw new Error("Selected team member no longer exists");

  // If the assigned project already completed (which auto-deducts its
  // teamPayAmount from that project's Earning — see markInvoicePaid), this
  // payslip is just the paperwork for money already booked. Otherwise this
  // payment hasn't hit the ledger anywhere yet, so record it as its own
  // outgoing TeamPayment entry.
  let alreadyBookedViaEarning = false;
  if (contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { status: true },
    });
    if (!contract) throw new Error("Selected project no longer exists");
    alreadyBookedViaEarning = contract.status === "COMPLETED";
  }

  const issueDateObj = new Date(issueDate);

  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.payslip.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = last ? last.number + 1 : PAYSLIP_NUMBER_START;

    try {
      await prisma.payslip.create({
        data: {
          number,
          teamMemberId,
          contractId: contractId || null,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          issueDate: issueDateObj,
          amount,
          note: note || null,
          createdByUserId,
          ...(alreadyBookedViaEarning
            ? {}
            : {
                teamPayment: {
                  create: {
                    date: issueDateObj,
                    name: `${teamMember.name} — Payslip PS-${String(number).padStart(5, "0")}`,
                    amount,
                    createdByUserId,
                  },
                },
              }),
        },
      });
      revalidatePath("/team/payslips");
      revalidatePath("/");
      return;
    } catch (e) {
      const isNumberConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isNumberConflict || attempt === 2) throw e;
    }
  }
}

export async function deletePayslip(id: string) {
  await requireUserId();

  await prisma.payslip.delete({ where: { id } });

  revalidatePath("/team/payslips");
  revalidatePath("/");
}
