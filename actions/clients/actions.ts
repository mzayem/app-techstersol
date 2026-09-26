"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  CLIENT_STATUSES,
  PAYMENT_CURRENCIES,
  type ClientStatus,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";

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

  const broughtByPartnerId = str(formData, "broughtByPartnerId") || null;

  return {
    name,
    phone,
    email,
    country,
    currency: currencyRaw as PaymentCurrency,
    status: statusRaw as ClientStatus,
    emailNotificationsEnabled:
      str(formData, "emailNotificationsEnabled") !== "false",
    broughtByPartnerId,
    // Only meaningful with a partner attributed — cleared otherwise so a
    // toggle flipped on before removing the attribution doesn't linger.
    phoneVisibleToPartner: broughtByPartnerId
      ? str(formData, "phoneVisibleToPartner") === "true"
      : false,
    emailVisibleToPartner: broughtByPartnerId
      ? str(formData, "emailVisibleToPartner") === "true"
      : false,
  };
}

export async function createClient(formData: FormData) {
  const { appUser } = await requirePagePermission("clients", "create");
  const createdByUserId = appUser.authUserId;
  const fields = readClientFields(formData);

  const r = await prisma.client.create({
    data: { ...fields, createdByUserId },
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "client",
    entityId: r.id,
    summary: `Added client "${r.name}"`,
    page: "clients",
  });

  revalidatePath("/clients");
}

export async function updateClient(id: string, formData: FormData) {
  const { appUser } = await requirePagePermission("clients", "edit");
  const fields = readClientFields(formData);

  const r = await prisma.client.update({
    where: { id },
    data: fields,
  });

  await logActivity(appUser, {
    action: "updated",
    entityType: "client",
    entityId: id,
    summary: `Edited client "${r.name}"`,
    page: "clients",
  });

  revalidatePath("/clients");
}

export async function deleteClient(id: string) {
  const { appUser } = await requirePagePermission("clients", "delete");

  const r = await prisma.client.delete({ where: { id } });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "client",
    entityId: id,
    summary: `Deleted client "${r.name}"`,
    page: "clients",
  });

  revalidatePath("/clients");
}
