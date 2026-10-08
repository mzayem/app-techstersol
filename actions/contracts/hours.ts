"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";
import {
  formatContractAmount,
  type BillingCycle,
} from "@/lib/contracts/constants";
import {
  addDaysUtc,
  formatPeriod,
  hourlyPeriodFor,
  startOfDayUtc,
} from "@/lib/contracts/billing";
import { formatInvoiceNumber } from "@/lib/invoices/constants";
import { createNumberedInvoice } from "@/lib/invoices/create";
import { notifyInvoiceCreated } from "@/lib/mail/notifications/invoices";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export type HourLogRow = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  hours: number;
  note: string | null;
  invoice: { number: number; status: "PAID" | "UNPAID" } | null;
};

async function getHourlyContract(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      number: true,
      clientId: true,
      projectName: true,
      paymentType: true,
      billingCycle: true,
      currency: true,
      amount: true,
      bankAccountId: true,
      invoiceDueDays: true,
      client: { select: { name: true } },
    },
  });
  if (!contract) throw new Error("Contract not found");
  if (contract.paymentType !== "HOURLY" || !contract.billingCycle) {
    throw new Error("Hours can only be logged on an hourly contract");
  }
  return { ...contract, billingCycle: contract.billingCycle as BillingCycle };
}

export async function listContractHourLogs(
  contractId: string,
): Promise<HourLogRow[]> {
  await requirePagePermission("contracts", "view");
  const logs = await prisma.contractHourLog.findMany({
    where: { contractId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      hours: true,
      note: true,
      invoiceItem: {
        select: { invoice: { select: { number: true, status: true } } },
      },
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  });
  return logs.map((log) => ({
    id: log.id,
    periodStart: log.periodStart,
    periodEnd: log.periodEnd,
    hours: Number(log.hours),
    note: log.note,
    invoice: log.invoiceItem
      ? {
          number: log.invoiceItem.invoice.number,
          status: log.invoiceItem.invoice.status as "PAID" | "UNPAID",
        }
      : null,
  }));
}

/** Logs hours against the week or month (per the contract's billing cycle)
 * containing the picked date. */
export async function addContractHourLog(
  contractId: string,
  formData: FormData,
) {
  const { appUser } = await requirePagePermission("contracts", "edit");
  const contract = await getHourlyContract(contractId);

  const dateRaw = str(formData, "periodDate");
  const hoursRaw = str(formData, "hours");
  const note = str(formData, "note");

  if (!dateRaw) throw new Error("Pick the week or month the hours are for");
  const hours = Number(hoursRaw);
  if (!hoursRaw || Number.isNaN(hours) || hours <= 0 || hours > 744) {
    throw new Error("Enter a valid number of hours");
  }

  const period = hourlyPeriodFor(new Date(dateRaw), contract.billingCycle);
  await prisma.contractHourLog.create({
    data: {
      contractId,
      periodStart: period.start,
      periodEnd: period.end,
      hours,
      note: note || null,
      createdByUserId: appUser.authUserId,
    },
  });

  await logActivity(appUser, {
    action: "created",
    entityType: "hour-log",
    entityId: contractId,
    summary: `Logged ${hours} h on "${contract.projectName}" for ${formatPeriod(period.start, period.end)}`,
    page: "contracts",
  });
  revalidatePath("/projects/contracts");
}

export async function deleteContractHourLog(id: string) {
  const { appUser } = await requirePagePermission("contracts", "edit");

  const log = await prisma.contractHourLog.findUnique({
    where: { id },
    select: {
      hours: true,
      periodStart: true,
      periodEnd: true,
      invoiceItemId: true,
      contract: { select: { id: true, projectName: true } },
    },
  });
  if (!log) return;
  if (log.invoiceItemId) {
    throw new Error(
      "These hours are already invoiced — delete the invoice first to change them",
    );
  }

  await prisma.contractHourLog.delete({ where: { id } });
  await logActivity(appUser, {
    action: "deleted",
    entityType: "hour-log",
    entityId: log.contract.id,
    summary: `Removed ${Number(log.hours)} logged h from "${log.contract.projectName}" (${formatPeriod(log.periodStart, log.periodEnd)})`,
    page: "contracts",
  });
  revalidatePath("/projects/contracts");
}

/** Bills every not-yet-invoiced hour on an hourly contract as one invoice
 * — one line per period — and emails it to the client. */
export async function invoiceContractHours(contractId: string) {
  const { appUser } = await requirePagePermission("invoices", "create");
  const contract = await getHourlyContract(contractId);

  const rate = Number(contract.amount ?? 0);
  if (!(rate > 0)) throw new Error("Set this contract's hourly rate first");
  if (!contract.bankAccountId) {
    throw new Error("Choose a bank account on this contract first");
  }

  const unbilled = await prisma.contractHourLog.findMany({
    where: { contractId, invoiceItemId: null },
    select: { id: true, periodStart: true, periodEnd: true, hours: true },
    orderBy: { periodStart: "asc" },
  });
  if (unbilled.length === 0) throw new Error("There are no unbilled hours");

  // One invoice line per period, however many separate entries it has.
  const periods = new Map<
    string,
    { start: Date; end: Date; hours: number; logIds: string[] }
  >();
  for (const log of unbilled) {
    const key = log.periodStart.toISOString();
    const period = periods.get(key) ?? {
      start: log.periodStart,
      end: log.periodEnd,
      hours: 0,
      logIds: [],
    };
    period.hours += Number(log.hours);
    period.logIds.push(log.id);
    periods.set(key, period);
  }
  const lines = [...periods.values()];
  const rateLabel = formatContractAmount(rate, contract.currency);

  const today = startOfDayUtc(new Date());
  const invoice = await createNumberedInvoice({
    clientId: contract.clientId,
    bankAccountId: contract.bankAccountId,
    currency: contract.currency,
    issueDate: today,
    dueDate: addDaysUtc(today, contract.invoiceDueDays),
    createdByUserId: appUser.authUserId,
    items: {
      create: lines.map((line, index) => ({
        description: `${contract.projectName} (contract #${contract.number}) — ${line.hours} h × ${rateLabel}/h, ${formatPeriod(line.start, line.end)}`,
        amount: Math.round(line.hours * rate * 100) / 100,
        contractId,
        periodStart: line.start,
        periodEnd: line.end,
        sortOrder: index,
      })),
    },
    contracts: { create: [{ contractId }] },
  });

  const items = await prisma.invoiceItem.findMany({
    where: { invoiceId: invoice.id },
    select: { id: true, sortOrder: true },
  });
  await prisma.$transaction(
    items.map((item) =>
      prisma.contractHourLog.updateMany({
        where: { id: { in: lines[item.sortOrder].logIds } },
        data: { invoiceItemId: item.id },
      }),
    ),
  );
  await prisma.contract.updateMany({
    where: { id: contractId, status: "ACTIVE" },
    data: { status: "PENDING_PAYMENT" },
  });

  const totalHours = lines.reduce((sum, l) => sum + l.hours, 0);
  await notifyInvoiceCreated(invoice.id);
  await logActivity(appUser, {
    action: "created",
    entityType: "invoice",
    entityId: invoice.id,
    summary: `Created invoice ${formatInvoiceNumber(invoice.number)} for ${contract.client.name} from ${totalHours} logged h on "${contract.projectName}"`,
    page: "invoices",
  });

  revalidatePath("/projects/contracts");
  revalidatePath("/projects/invoices");
  return { invoiceNumber: formatInvoiceNumber(invoice.number) };
}
