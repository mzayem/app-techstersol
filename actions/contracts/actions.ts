"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { createNumberedContract } from "@/lib/contracts/numbering";
import {
  PAYMENT_CURRENCIES,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import {
  BILLING_CYCLES,
  CONTRACT_STATUSES,
  HOURLY_BILLING_CYCLES,
  PAYMENT_TYPES,
  PROJECT_STATUSES,
  RECURRING_CREATE_STATUSES,
  RECURRING_STATUSES,
  WORK_COST_MODES,
  contractRevenueBasis,
  contractStatusLabel,
  isOpenEnded,
  type BillingCycle,
  type ContractPaymentType,
  type ContractStatus,
  type ContractWorkCostMode,
  type MilestoneInput,
} from "@/lib/contracts/constants";
import {
  generateDueRecurringInvoices,
  isRecurringBillingStatus,
  resolveNextInvoiceDate,
} from "@/lib/contracts/recurring";
import { requirePagePermission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity/log";
import { validateMilestones } from "@/lib/contracts/validation";
import {
  notifyContractAssigned,
  notifyContractCreated,
  notifyContractStatusChanged,
} from "@/lib/mail/notifications/contracts";
import { getRatesToPkr } from "@/lib/fx/rates";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** The live FX estimate the contract dialog fetches once on open, to
 * client-side compute the editable "estimated work cost" preview for a
 * percentage-mode partnered contract — see readContractFields below for
 * the server-side counterpart used at save time. */
export async function getFxEstimate() {
  return getRatesToPkr();
}

async function readContractFields(
  formData: FormData,
  milestonesInput: MilestoneInput[],
) {
  const clientId = str(formData, "clientId");
  const date = str(formData, "date");
  const deadline = str(formData, "deadline");
  const projectName = str(formData, "projectName");
  const description = str(formData, "description");
  const currencyRaw = str(formData, "currency");
  const paymentTypeRaw = str(formData, "paymentType");
  const statusRaw = str(formData, "status") || "PROPOSED";
  const amountRaw = str(formData, "amount");
  const teamMemberId = str(formData, "teamMemberId");
  const teamPayAmountRaw = str(formData, "teamPayAmount");
  const statusEmailsEnabled = str(formData, "statusEmailsEnabled") !== "false";
  const chatNotificationsEnabled =
    str(formData, "chatNotificationsEnabled") === "true";
  const partnerId = str(formData, "partnerId");
  const workCostModeRaw = str(formData, "workCostMode");
  const workCostPercentRaw = str(formData, "workCostPercent");
  const partnerSharePercentRaw = str(formData, "partnerSharePercent");
  const billingCycleRaw = str(formData, "billingCycle");
  const bankAccountId = str(formData, "bankAccountId");
  const invoiceDueDaysRaw = str(formData, "invoiceDueDays");
  const terms = str(formData, "terms");

  if (!PAYMENT_TYPES.includes(paymentTypeRaw as ContractPaymentType)) {
    throw new Error("Invalid payment type");
  }
  const paymentType = paymentTypeRaw as ContractPaymentType;
  const openEnded = isOpenEnded(paymentType);

  if (!clientId || !date || !projectName) {
    throw new Error("Client, start date, and project name are required");
  }
  // An hourly or recurring contract can run with no end date.
  if (!deadline && !openEnded) {
    throw new Error("A deadline is required");
  }
  // The end date bounds billing, so it can't precede the start.
  if (openEnded && deadline && deadline < date) {
    throw new Error("End date can't be before the start date");
  }
  if (!PAYMENT_CURRENCIES.includes(currencyRaw as PaymentCurrency)) {
    throw new Error("Invalid currency");
  }
  const allowedStatuses: readonly string[] =
    paymentType === "RECURRING" ? RECURRING_STATUSES : PROJECT_STATUSES;
  if (!allowedStatuses.includes(statusRaw)) {
    throw new Error("Invalid status");
  }

  const currency = currencyRaw as PaymentCurrency;

  let billingCycle: BillingCycle | null = null;
  let invoiceDueDays = 7;
  if (openEnded) {
    const allowedCycles: readonly string[] =
      paymentType === "HOURLY" ? HOURLY_BILLING_CYCLES : BILLING_CYCLES;
    if (!allowedCycles.includes(billingCycleRaw)) {
      throw new Error(
        paymentType === "HOURLY"
          ? "Choose whether hours are invoiced weekly or monthly"
          : "Choose a billing cycle",
      );
    }
    billingCycle = billingCycleRaw as BillingCycle;

    if (!bankAccountId) {
      throw new Error("Choose the bank account invoices should be paid into");
    }
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { currency: true },
    });
    if (!bankAccount) throw new Error("Selected bank account no longer exists");
    if (bankAccount.currency !== currency) {
      throw new Error("The bank account's currency must match the contract's");
    }

    if (invoiceDueDaysRaw) {
      invoiceDueDays = Number(invoiceDueDaysRaw);
      if (
        !Number.isInteger(invoiceDueDays) ||
        invoiceDueDays < 0 ||
        invoiceDueDays > 120
      ) {
        throw new Error(
          "Invoice due days must be a whole number from 0 to 120",
        );
      }
    }
  }
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

  // Every structure but MILESTONE carries one amount: the project total,
  // the amount per billing cycle (RECURRING), or the hourly rate (HOURLY).
  const hasAmount = paymentType !== "MILESTONE";
  const amount = hasAmount ? Number(amountRaw) : undefined;
  if (hasAmount && (!amountRaw || Number.isNaN(amount) || amount! <= 0)) {
    throw new Error(
      paymentType === "HOURLY"
        ? "Enter a valid hourly rate"
        : paymentType === "RECURRING"
          ? "Enter a valid amount per billing cycle"
          : "Enter a valid project amount",
    );
  }

  // Partner-specific fields only ever apply when a partner is attached —
  // switching the partner off must cleanly null out every one of these,
  // even if the form somehow still submitted stale values for them.
  let workCostMode: ContractWorkCostMode | null = null;
  let workCostPercent: number | null = null;
  let partnerSharePercent: number | null = null;
  let teamPayAmount: number | null = null;

  if (partnerId) {
    if (!WORK_COST_MODES.includes(workCostModeRaw as ContractWorkCostMode)) {
      throw new Error("Select a work cost mode for a partnered contract");
    }
    workCostMode = workCostModeRaw as ContractWorkCostMode;

    if (partnerSharePercentRaw) {
      partnerSharePercent = Number(partnerSharePercentRaw);
      if (
        Number.isNaN(partnerSharePercent) ||
        partnerSharePercent < 0 ||
        partnerSharePercent > 100
      ) {
        throw new Error("Partner share % must be between 0 and 100");
      }
    }

    if (workCostMode === "PERCENTAGE") {
      workCostPercent = Number(workCostPercentRaw);
      if (
        !workCostPercentRaw ||
        Number.isNaN(workCostPercent) ||
        workCostPercent < 0 ||
        workCostPercent > 100
      ) {
        throw new Error("Work cost % must be between 0 and 100");
      }

      // The dialog recomputes this estimate client-side and lets the admin
      // review/override it before saving, so whatever ends up in
      // teamPayAmount is what actually gets stored. Only fall back to a
      // fresh server-side computation if that field didn't arrive (or
      // arrived invalid) — a safety net, not the primary path.
      const submitted = Number(teamPayAmountRaw);
      if (teamPayAmountRaw && !Number.isNaN(submitted) && submitted >= 0) {
        teamPayAmount = submitted;
      } else {
        const revenueBasis = contractRevenueBasis({
          paymentType,
          amount: hasAmount ? amount : null,
          milestones: milestoneData,
        });
        let pkrRevenueBasis = revenueBasis;
        if (currency !== "PKR") {
          const rates = await getRatesToPkr();
          pkrRevenueBasis = revenueBasis * rates[currency];
        }
        teamPayAmount = (pkrRevenueBasis * workCostPercent) / 100;
      }
    } else {
      // FIXED mode with a partner: a company-handled partnered contract
      // (no teamMemberId) may legitimately have zero work cost, so this is
      // only strictly required (and > 0) when a team member is assigned —
      // same rule as the no-partner case below.
      if (teamMemberId) {
        teamPayAmount = Number(teamPayAmountRaw);
        if (
          !teamPayAmountRaw ||
          Number.isNaN(teamPayAmount) ||
          teamPayAmount <= 0
        ) {
          throw new Error(
            "Enter the team member's pay (PKR) for an outsourced contract",
          );
        }
      } else {
        teamPayAmount = teamPayAmountRaw ? Number(teamPayAmountRaw) : 0;
        if (Number.isNaN(teamPayAmount) || teamPayAmount < 0) {
          throw new Error("Enter a valid work cost (PKR)");
        }
      }
    }
  } else if (teamMemberId) {
    teamPayAmount = Number(teamPayAmountRaw);
    if (
      !teamPayAmountRaw ||
      Number.isNaN(teamPayAmount) ||
      teamPayAmount <= 0
    ) {
      throw new Error(
        "Enter the team member's pay (PKR) for an outsourced contract",
      );
    }
  }

  return {
    clientId,
    date: new Date(date),
    deadline: deadline ? new Date(deadline) : null,
    projectName,
    description: description || null,
    currency,
    paymentType,
    amount: hasAmount ? amount : null,
    status: statusRaw as ContractStatus,
    billingCycle,
    bankAccountId: openEnded ? bankAccountId : null,
    invoiceDueDays,
    terms: terms || null,
    teamMemberId: teamMemberId || null,
    teamPayAmount,
    statusEmailsEnabled,
    chatNotificationsEnabled,
    partnerId: partnerId || null,
    workCostMode,
    workCostPercent,
    partnerSharePercent,
    milestones: milestoneData,
  };
}

function revalidateContractPages() {
  revalidatePath("/projects/contracts");
  revalidatePath("/projects/recurring");
  revalidatePath("/projects/invoices");
}

const statusLabel = contractStatusLabel;

export async function createContract(
  formData: FormData,
  milestones: MilestoneInput[],
) {
  const { appUser } = await requirePagePermission("contracts", "create");
  const createdByUserId = appUser.authUserId;
  const { milestones: validMilestones, ...fields } = await readContractFields(
    formData,
    milestones,
  );

  if (
    fields.paymentType === "RECURRING" &&
    !(RECURRING_CREATE_STATUSES as readonly string[]).includes(fields.status)
  ) {
    throw new Error(
      "A new recurring contract starts as Draft or Awaiting advance payment — it becomes Active once the advance invoice is paid",
    );
  }

  const nextInvoiceDate =
    fields.paymentType === "RECURRING"
      ? await resolveNextInvoiceDate({
          contractId: null,
          startDate: fields.date,
          cycle: fields.billingCycle!,
          enteringBilling: isRecurringBillingStatus(fields.status),
          previousNext: null,
        })
      : null;

  const created = await createNumberedContract({
    ...fields,
    nextInvoiceDate,
    createdByUserId,
    milestones: { create: validMilestones },
  });

  await notifyContractCreated(created.id);
  await logActivity(appUser, {
    action: "created",
    entityType: "contract",
    entityId: created.id,
    summary: `Created ${created.paymentType === "RECURRING" ? "recurring " : ""}contract #${created.number} "${created.projectName}"`,
    page: "contracts",
  });
  if (created.paymentType === "RECURRING") {
    await generateDueRecurringInvoices({ contractId: created.id });
  }
  revalidateContractPages();
}

export async function updateContract(
  id: string,
  formData: FormData,
  milestones: MilestoneInput[],
) {
  const { appUser } = await requirePagePermission("contracts", "edit");
  const { milestones: validMilestones, ...fields } = await readContractFields(
    formData,
    milestones,
  );

  const before = await prisma.contract.findUnique({
    where: { id },
    select: {
      status: true,
      paymentType: true,
      currency: true,
      nextInvoiceDate: true,
      teamMemberId: true,
      partnerId: true,
      projectName: true,
    },
  });
  if (!before) throw new Error("Contract not found");
  // Recurring contracts live on their own page with their own invoicing —
  // converting one to/from a fixed-price contract would orphan that.
  if (
    (before.paymentType === "RECURRING") !==
    (fields.paymentType === "RECURRING")
  ) {
    throw new Error(
      "A recurring contract can't be converted to another payment structure (or back) — create a new contract instead",
    );
  }
  // Project expenses are recorded in the contract currency — switching it
  // would silently relabel every one of them.
  if (before.currency !== fields.currency) {
    const expenses = await prisma.projectExpense.count({
      where: { contractId: id },
    });
    if (expenses > 0) {
      throw new Error(
        `This contract has project expenses recorded in ${before.currency} — remove them before changing its currency`,
      );
    }
  }
  if (before.paymentType === "HOURLY" && fields.paymentType !== "HOURLY") {
    const loggedHours = await prisma.contractHourLog.count({
      where: { contractId: id },
    });
    if (loggedHours > 0) {
      throw new Error(
        "This contract has logged hours — delete them before changing its payment structure",
      );
    }
  }

  const nextInvoiceDate =
    fields.paymentType === "RECURRING"
      ? await resolveNextInvoiceDate({
          contractId: id,
          startDate: fields.date,
          cycle: fields.billingCycle!,
          enteringBilling:
            isRecurringBillingStatus(fields.status) &&
            !isRecurringBillingStatus(before.status),
          previousNext: before.nextInvoiceDate,
        })
      : null;

  await prisma.contract.update({
    where: { id },
    data: {
      ...fields,
      nextInvoiceDate,
      milestones: {
        deleteMany: {},
        create: validMilestones,
      },
    },
  });

  if (before.status !== fields.status) {
    await notifyContractStatusChanged(id);
  }
  const statusNote =
    before.status !== fields.status
      ? ` — status ${statusLabel(before.status, fields.paymentType)} → ${statusLabel(fields.status, fields.paymentType)}`
      : "";
  await logActivity(appUser, {
    action: "updated",
    entityType: "contract",
    entityId: id,
    summary: `Edited contract "${fields.projectName}"${statusNote}`,
    page: "contracts",
  });
  await notifyContractAssigned(id, {
    partner: !!fields.partnerId && fields.partnerId !== before.partnerId,
    teamMember:
      !!fields.teamMemberId && fields.teamMemberId !== before.teamMemberId,
  });
  if (fields.paymentType === "RECURRING") {
    await generateDueRecurringInvoices({ contractId: id });
  }
  revalidateContractPages();
}

export async function deleteContract(id: string) {
  const { appUser } = await requirePagePermission("contracts", "delete");

  const deleted = await prisma.contract.delete({ where: { id } });

  await logActivity(appUser, {
    action: "deleted",
    entityType: "contract",
    entityId: id,
    summary: `Deleted contract "${deleted.projectName}"`,
    page: "contracts",
  });

  revalidateContractPages();
}

export async function bulkUpdateContractStatus(
  ids: string[],
  status: ContractStatus,
) {
  const { appUser } = await requirePagePermission("contracts", "edit");

  if (ids.length === 0) return;
  if (!CONTRACT_STATUSES.includes(status)) {
    throw new Error("Invalid status");
  }

  const before = await prisma.contract.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      projectName: true,
      paymentType: true,
      date: true,
      billingCycle: true,
      nextInvoiceDate: true,
    },
  });
  if (
    before.some(
      (c) =>
        c.paymentType === "RECURRING" &&
        !(RECURRING_STATUSES as readonly string[]).includes(status),
    )
  ) {
    throw new Error(
      `"${statusLabel(status, "PROJECT")}" isn't a status a recurring contract can have`,
    );
  }
  if (
    status === "AWAITING_ADVANCE" &&
    before.some((c) => c.paymentType !== "RECURRING")
  ) {
    throw new Error("Only a recurring contract can await an advance payment");
  }

  await prisma.contract.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  const changed = before.filter((c) => c.status !== status);

  // A recurring contract switched into billing picks its schedule back up
  // from the current period, then invoices it if it's due.
  const resumed = changed.filter(
    (c) =>
      c.paymentType === "RECURRING" &&
      c.billingCycle &&
      isRecurringBillingStatus(status) &&
      !isRecurringBillingStatus(c.status),
  );
  for (const c of resumed) {
    const nextInvoiceDate = await resolveNextInvoiceDate({
      contractId: c.id,
      startDate: c.date,
      cycle: c.billingCycle as BillingCycle,
      enteringBilling: true,
      previousNext: c.nextInvoiceDate,
    });
    await prisma.contract.update({
      where: { id: c.id },
      data: { nextInvoiceDate },
    });
    await generateDueRecurringInvoices({ contractId: c.id });
  }

  await Promise.all(changed.map((c) => notifyContractStatusChanged(c.id)));
  await Promise.all(
    changed.map((c) =>
      logActivity(appUser, {
        action: "status-changed",
        entityType: "contract",
        entityId: c.id,
        summary: `Changed contract "${c.projectName}" status ${statusLabel(c.status, c.paymentType)} → ${statusLabel(status, c.paymentType)}`,
        page: "contracts",
      }),
    ),
  );

  revalidateContractPages();
}
