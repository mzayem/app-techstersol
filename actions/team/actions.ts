"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";

async function requireUserId() {
  const { data } = await auth.getSession();
  if (!data?.user) throw new Error("Not signed in");
  return data.user.id;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readTeamMemberFields(formData: FormData) {
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const country = str(formData, "country");
  const currencyRaw = str(formData, "currency");
  const address = str(formData, "address");

  if (!name) {
    throw new Error("Name is required");
  }
  if (email && !EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (currencyRaw && !PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid payment currency");
  }

  return {
    name,
    phone: phone || null,
    email: email || null,
    country: country || null,
    currency: currencyRaw ? (currencyRaw as PaymentCurrency) : null,
    address: address || null,
  };
}

export async function createTeamMember(formData: FormData) {
  const createdByUserId = await requireUserId();
  const fields = readTeamMemberFields(formData);

  await prisma.teamMember.create({
    data: { ...fields, createdByUserId },
  });

  revalidatePath("/team");
}

export async function updateTeamMember(id: string, formData: FormData) {
  await requireUserId();
  const fields = readTeamMemberFields(formData);

  await prisma.teamMember.update({
    where: { id },
    data: fields,
  });

  revalidatePath("/team");
}

export async function deleteTeamMember(id: string) {
  await requireUserId();

  try {
    await prisma.teamMember.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Error("Can't delete a team member who has payslips on record");
    }
    throw e;
  }

  revalidatePath("/team");
  revalidatePath("/projects/contracts");
}
