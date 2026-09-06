"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  PAYMENT_CURRENCIES,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import {
  BANK_FIELD_LABELS,
  CURRENCY_FIELDS,
  CURRENCY_OPTIONAL_FIELDS,
  type BankFieldKey,
} from "@/lib/bank-accounts/constants";
import { requirePagePermission } from "@/lib/rbac/permissions";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBankAccountFields(formData: FormData) {
  const currencyRaw = str(formData, "currency");
  const bankName = str(formData, "bankName");
  const accountHolderName = str(formData, "accountHolderName");
  const swift = str(formData, "swift");

  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid currency");
  }
  if (!bankName || !accountHolderName || !swift) {
    throw new Error("Bank name, account holder name, and SWIFT are required");
  }

  const currency = currencyRaw as PaymentCurrency;
  const values: Record<BankFieldKey, string> = {
    accountType: str(formData, "accountType"),
    routingNumber: str(formData, "routingNumber"),
    accountNumber: str(formData, "accountNumber"),
    iban: str(formData, "iban"),
    sortCode: str(formData, "sortCode"),
    bsbCode: str(formData, "bsbCode"),
  };

  const optionalFields = CURRENCY_OPTIONAL_FIELDS[currency];
  for (const field of CURRENCY_FIELDS[currency]) {
    if (optionalFields?.includes(field)) continue;
    if (!values[field]) {
      throw new Error(
        `${BANK_FIELD_LABELS[field]} is required for ${currency} accounts`,
      );
    }
  }

  return {
    currency,
    bankName,
    accountHolderName,
    swift,
    accountType: values.accountType || null,
    routingNumber: values.routingNumber || null,
    accountNumber: values.accountNumber || null,
    iban: values.iban || null,
    sortCode: values.sortCode || null,
    bsbCode: values.bsbCode || null,
  };
}

export async function createBankAccount(formData: FormData) {
  const { appUser } = await requirePagePermission("bank-details", "create");
  const createdByUserId = appUser.authUserId;
  const fields = readBankAccountFields(formData);

  await prisma.bankAccount.create({
    data: { ...fields, createdByUserId },
  });

  revalidatePath("/account/bank-details");
}

export async function updateBankAccount(id: string, formData: FormData) {
  await requirePagePermission("bank-details", "edit");
  const fields = readBankAccountFields(formData);

  await prisma.bankAccount.update({
    where: { id },
    data: fields,
  });

  revalidatePath("/account/bank-details");
}

export async function deleteBankAccount(id: string) {
  await requirePagePermission("bank-details", "delete");

  await prisma.bankAccount.delete({ where: { id } });

  revalidatePath("/account/bank-details");
}
