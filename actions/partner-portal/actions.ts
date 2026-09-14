"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/lib/clients/constants";
import {
  PAYMENT_TYPES,
  formatContractAmount,
  type ContractPaymentType,
  type MilestoneInput,
} from "@/lib/contracts/constants";
import { INVOICE_NUMBER_START } from "@/lib/invoices/constants";
import { invoicedAmountsByLine, remainingKey } from "@/actions/invoices/queries";
import { validateMilestones } from "@/lib/contracts/validation";
import { requirePartnerUser } from "@/lib/rbac/permissions";
import { notifyProposalSubmitted } from "@/lib/mail/notifications/contracts";
import { notifyInvoiceCreated } from "@/lib/mail/notifications/invoices";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A partner's self-service "new client I brought in" form. Always tagged
 * with this partner's own id (Client.broughtByPartnerId) and always
 * created with phone/email visibility off — same defaults an admin would
 * use, since the admin (not the partner) controls when those get exposed
 * back to the partner portal, even for a client the partner typed in
 * themselves. */
export async function createPartnerClient(formData: FormData) {
  const appUser = await requirePartnerUser();
  const partnerId = appUser.partner!.id;

  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const country = str(formData, "country");
  const currencyRaw = str(formData, "currency");

  if (!name || !phone || !email || !country) {
    throw new Error("Name, phone, email, and country are required");
  }
  if (!EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid payment currency");
  }

  const client = await prisma.client.create({
    data: {
      name,
      phone,
      email,
      country,
      currency: currencyRaw as PaymentCurrency,
      status: "ACTIVE",
      emailNotificationsEnabled: true,
      broughtByPartnerId: partnerId,
      phoneVisibleToPartner: false,
      emailVisibleToPartner: false,
      createdByUserId: appUser.authUserId,
    },
    select: { id: true, name: true, currency: true },
  });

  revalidatePath("/partner-portal/projects");
  return { id: client.id, name: client.name, currency: client.currency as PaymentCurrency };
}

function readPartnerContractFields(formData: FormData, milestonesInput: MilestoneInput[]) {
  const date = str(formData, "date");
  const deadline = str(formData, "deadline");
  const projectName = str(formData, "projectName");
  const description = str(formData, "description");
  const paymentTypeRaw = str(formData, "paymentType");
  const amountRaw = str(formData, "amount");
  const teamMemberId = str(formData, "teamMemberId");
  const suggestedWorkCostRaw = str(formData, "suggestedWorkCost");

  if (!date || !deadline || !projectName) {
    throw new Error("Dates and project name are required");
  }
  if (!PAYMENT_TYPES.includes(paymentTypeRaw as ContractPaymentType)) {
    throw new Error("Invalid payment type");
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

  let suggestedWorkCost: number | null = null;
  if (teamMemberId && suggestedWorkCostRaw) {
    suggestedWorkCost = Number(suggestedWorkCostRaw);
    if (Number.isNaN(suggestedWorkCost) || suggestedWorkCost <= 0) {
      throw new Error("Enter a valid suggested work cost, or leave it blank");
    }
  }

  return {
    date: new Date(date),
    deadline: new Date(deadline),
    projectName,
    description: description || null,
    paymentType,
    amount: paymentType === "PROJECT" ? amount : null,
    milestones: milestoneData,
    teamMemberId: teamMemberId || null,
    suggestedWorkCost,
  };
}

/** A partner's self-service "propose a new project" form — mirrors
 * createClientContractRequest (actions/client-portal/actions.ts) closely:
 * always lands as PROPOSED, always billed in the target client's own
 * on-file currency, and the admin fills in the real work-cost figure,
 * team assignment, and profit-share percentage afterward. The client must
 * already be attributed to this partner (Client.broughtByPartnerId) — the
 * submitted clientId is re-validated against that, never trusted from the
 * form alone. A suggested team member + work-cost figure is purely a
 * starting point for the admin (stored directly on teamMemberId/
 * teamPayAmount since the schema allows it), never required. */
export async function createPartnerContractRequest(
  formData: FormData,
  milestones: MilestoneInput[],
) {
  const appUser = await requirePartnerUser();
  const partnerId = appUser.partner!.id;

  const requestedClientId = str(formData, "clientId");
  const client = await prisma.client.findFirst({
    where: { id: requestedClientId, broughtByPartnerId: partnerId },
    select: { id: true, name: true, currency: true },
  });
  if (!client) {
    throw new Error("Select a client you've brought in");
  }

  const {
    milestones: validMilestones,
    teamMemberId,
    suggestedWorkCost,
    ...fields
  } = readPartnerContractFields(formData, milestones);

  await prisma.contract.create({
    data: {
      ...fields,
      clientId: client.id,
      currency: client.currency,
      status: "PROPOSED",
      partnerId,
      teamMemberId,
      teamPayAmount: suggestedWorkCost,
      createdByUserId: appUser.authUserId,
      milestones: { create: validMilestones },
    },
  });

  await notifyProposalSubmitted({ clientName: client.name, projectName: fields.projectName });
  revalidatePath("/partner-portal/projects");
}

export type PartnerInvoiceItemInput = {
  contractId: string;
  milestoneId: string | null;
  description: string;
  amount: number;
};

/** Re-implements createInvoice's numbering/line-item logic (actions/invoices/
 * actions.ts) rather than importing it, since that one is gated behind
 * dashboard RBAC — this version is gated behind requirePartnerUser and only
 * ever looks up contracts owned by this partner (Contract.partnerId), so a
 * partner can't invoice a project that isn't theirs no matter what the form
 * submits. No discount field here — deliberately: discounting a client
 * balance is a dashboard/admin call, not a partner's. Fires
 * notifyInvoiceCreated right after creation, same as the admin flow — no
 * separate manual "send" step. */
export async function createPartnerInvoice(formData: FormData, items: PartnerInvoiceItemInput[]) {
  const appUser = await requirePartnerUser();
  const partnerId = appUser.partner!.id;

  const clientId = str(formData, "clientId");
  const bankAccountId = str(formData, "bankAccountId");
  const currencyRaw = str(formData, "currency");
  const issueDate = str(formData, "issueDate");
  const dueDate = str(formData, "dueDate");

  if (!clientId || !bankAccountId || !issueDate || !dueDate) {
    throw new Error("Client, bank account, and dates are required");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid currency");
  }
  if (items.length === 0) {
    throw new Error("Select at least one contract or milestone");
  }
  for (const item of items) {
    if (!item.contractId || !item.description.trim() || !(item.amount > 0)) {
      throw new Error("Each line item needs a source, a description, and a positive amount");
    }
  }

  const currency = currencyRaw as PaymentCurrency;
  const contractIds = [...new Set(items.map((item) => item.contractId))];

  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds }, partnerId },
    select: {
      id: true,
      clientId: true,
      currency: true,
      paymentType: true,
      amount: true,
      milestones: { select: { id: true, amount: true } },
    },
  });
  if (contracts.length !== contractIds.length) {
    throw new Error("One or more selected contracts aren't yours to invoice");
  }
  for (const contract of contracts) {
    if (contract.clientId !== clientId) {
      throw new Error("Selected contracts must all belong to the selected client");
    }
    if (contract.currency !== currency) {
      throw new Error("Selected contracts must all share the same currency");
    }
  }

  const invoiced = await invoicedAmountsByLine(contractIds);
  const contractsById = new Map(contracts.map((c) => [c.id, c]));
  const preparedItems = items.map((item, index) => {
    const contract = contractsById.get(item.contractId)!;
    const faceAmount = item.milestoneId
      ? Number(contract.milestones.find((m) => m.id === item.milestoneId)?.amount ?? 0)
      : Number(contract.amount ?? 0);
    const alreadyInvoiced = invoiced.get(remainingKey(item.contractId, item.milestoneId)) ?? 0;
    const remaining = faceAmount - alreadyInvoiced;

    if (remaining <= 0.01) {
      throw new Error("One of the selected lines has already been fully invoiced");
    }
    if (item.amount > remaining + 0.01) {
      throw new Error("A line item's amount can't exceed its remaining balance");
    }

    const isPartial = item.amount < remaining - 0.01;
    const description = isPartial
      ? `${item.description.trim()} (Partial payment — remaining ${formatContractAmount(
          remaining - item.amount,
          currency,
        )})`
      : item.description.trim();

    return {
      description,
      amount: item.amount,
      contractId: item.contractId,
      milestoneId: item.milestoneId,
      isPartial,
      sortOrder: index,
    };
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.invoice.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = last ? last.number + 1 : INVOICE_NUMBER_START;

    try {
      const created = await prisma.invoice.create({
        data: {
          number,
          clientId,
          bankAccountId,
          currency,
          discount: 0,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          createdByUserId: appUser.authUserId,
          items: { create: preparedItems },
          contracts: { create: contractIds.map((contractId) => ({ contractId })) },
        },
      });
      await notifyInvoiceCreated(created.id);
      revalidatePath("/partner-portal/invoices");
      return;
    } catch (e) {
      const isNumberConflict = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isNumberConflict || attempt === 2) throw e;
    }
  }
}
