"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  CLIENT_STATUSES,
  PAYMENT_CURRENCIES,
  type ClientStatus,
  type PaymentCurrency,
} from "@/lib/clients/constants";

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

function readClientFields(formData: FormData) {
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const country = str(formData, "country");
  const currencyRaw = str(formData, "currency");
  const statusRaw = str(formData, "status") || "ACTIVE";

  if (!name || !phone || !email || !country) {
    throw new Error("Name, phone, email, and country are required");
  }
  if (!EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid payment currency");
  }
  if (!CLIENT_STATUSES.includes(statusRaw as ClientStatus)) {
    throw new Error("Invalid status");
  }

  return {
    name,
    phone,
    email,
    country,
    currency: currencyRaw as PaymentCurrency,
    status: statusRaw as ClientStatus,
  };
}

export async function createClient(formData: FormData) {
  const createdByUserId = await requireUserId();
  const fields = readClientFields(formData);

  await prisma.client.create({
    data: { ...fields, createdByUserId },
  });

  revalidatePath("/clients");
}

export async function updateClient(id: string, formData: FormData) {
  await requireUserId();
  const fields = readClientFields(formData);

  await prisma.client.update({
    where: { id },
    data: fields,
  });

  revalidatePath("/clients");
}

export async function deleteClient(id: string) {
  await requireUserId();

  await prisma.client.delete({ where: { id } });

  revalidatePath("/clients");
}
