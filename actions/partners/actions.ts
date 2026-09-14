"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  PAYMENT_CURRENCIES,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import { requirePagePermission } from "@/lib/rbac/permissions";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readPartnerFields(formData: FormData) {
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const currencyRaw = str(formData, "currency");
  const sharePercentageRaw = str(formData, "sharePercentage");

  if (!name) {
    throw new Error("Name is required");
  }
  if (email && !EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Payment currency is required");
  }

  const sharePercentage = Number(sharePercentageRaw);
  if (
    !sharePercentageRaw ||
    Number.isNaN(sharePercentage) ||
    sharePercentage < 0 ||
    sharePercentage > 100
  ) {
    throw new Error("Enter a valid share percentage between 0 and 100");
  }

  return {
    name,
    phone: phone || null,
    email: email || null,
    currency: currencyRaw as PaymentCurrency,
    sharePercentage,
    // Only meaningful when there's an email on file to send to.
    payslipEmailsEnabled:
      !!email && str(formData, "payslipEmailsEnabled") !== "false",
    chatEnabled: str(formData, "chatEnabled") === "true",
  };
}

export async function createPartner(formData: FormData) {
  const { appUser } = await requirePagePermission("partners", "create");
  const createdByUserId = appUser.authUserId;
  const fields = readPartnerFields(formData);

  await prisma.partner.create({
    data: { ...fields, createdByUserId },
  });

  revalidatePath("/partners");
}

export async function updatePartner(id: string, formData: FormData) {
  await requirePagePermission("partners", "edit");
  const fields = readPartnerFields(formData);

  await prisma.partner.update({
    where: { id },
    data: fields,
  });

  revalidatePath("/partners");
}

export async function deletePartner(id: string) {
  await requirePagePermission("partners", "delete");

  try {
    await prisma.partner.delete({ where: { id } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      throw new Error(
        "Can't delete a partner who has contracts or payslips on record",
      );
    }
    throw e;
  }

  revalidatePath("/partners");
  revalidatePath("/projects/contracts");
}
