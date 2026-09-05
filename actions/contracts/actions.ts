"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";
import {
  CONTRACT_STATUSES,
  PAYMENT_TYPES,
  type ContractPaymentType,
  type ContractStatus,
  type MilestoneInput,
} from "@/lib/contracts/constants";

async function requireUserId() {
  const { data } = await auth.getSession();
  if (!data?.user) throw new Error("Not signed in");
  return data.user.id;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validateMilestones(milestones: MilestoneInput[]) {
  for (const milestone of milestones) {
    if (
      typeof milestone.name !== "string" ||
      typeof milestone.amount !== "number" ||
      typeof milestone.deadline !== "string" ||
      !milestone.name.trim() ||
      !milestone.deadline ||
      !(milestone.amount > 0)
    ) {
      throw new Error("Each milestone needs a name, amount, and deadline");
    }
  }
}

function readContractFields(formData: FormData, milestonesInput: MilestoneInput[]) {
  const clientId = str(formData, "clientId");
  const date = str(formData, "date");
  const deadline = str(formData, "deadline");
  const projectName = str(formData, "projectName");
  const description = str(formData, "description");
  const currencyRaw = str(formData, "currency");
  const paymentTypeRaw = str(formData, "paymentType");
  const statusRaw = str(formData, "status") || "PROPOSED";
  const amountRaw = str(formData, "amount");

  if (!clientId || !date || !deadline || !projectName) {
    throw new Error("Client, dates, and project name are required");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid currency");
  }
  if (!PAYMENT_TYPES.includes(paymentTypeRaw as ContractPaymentType)) {
    throw new Error("Invalid payment type");
  }
  if (!CONTRACT_STATUSES.includes(statusRaw as ContractStatus)) {
    throw new Error("Invalid status");
  }

  const paymentType = paymentTypeRaw as ContractPaymentType;
  const milestones = paymentType === "MILESTONE" ? milestonesInput : [];
  if (paymentType === "MILESTONE" && milestones.length === 0) {
    throw new Error("Add at least one milestone");
  }
  validateMilestones(milestones);
  const milestoneData = milestones.map((m) => ({
    name: m.name.trim(),
    amount: m.amount,
    deadline: new Date(m.deadline),
  }));

  const amount = paymentType === "PROJECT" ? Number(amountRaw) : undefined;
  if (paymentType === "PROJECT" && (!amountRaw || Number.isNaN(amount) || amount! <= 0)) {
    throw new Error("Enter a valid project amount");
  }

  return {
    clientId,
    date: new Date(date),
    deadline: new Date(deadline),
    projectName,
    description: description || null,
    currency: currencyRaw as PaymentCurrency,
    paymentType,
    amount: paymentType === "PROJECT" ? amount : null,
    status: statusRaw as ContractStatus,
    milestones: milestoneData,
  };
}

export async function createContract(formData: FormData, milestones: MilestoneInput[]) {
  const createdByUserId = await requireUserId();
  const { milestones: validMilestones, ...fields } = readContractFields(formData, milestones);

  await prisma.contract.create({
    data: {
      ...fields,
      createdByUserId,
      milestones: { create: validMilestones },
    },
  });

  revalidatePath("/projects/contracts");
}

export async function updateContract(
  id: string,
  formData: FormData,
  milestones: MilestoneInput[],
) {
  await requireUserId();
  const { milestones: validMilestones, ...fields } = readContractFields(formData, milestones);

  await prisma.contract.update({
    where: { id },
    data: {
      ...fields,
      milestones: {
        deleteMany: {},
        create: validMilestones,
      },
    },
  });

  revalidatePath("/projects/contracts");
}

export async function deleteContract(id: string) {
  await requireUserId();

  await prisma.contract.delete({ where: { id } });

  revalidatePath("/projects/contracts");
}

export async function bulkUpdateContractStatus(ids: string[], status: ContractStatus) {
  await requireUserId();

  if (ids.length === 0) return;
  if (!CONTRACT_STATUSES.includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.contract.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  revalidatePath("/projects/contracts");
}
