"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  PAYMENT_CURRENCIES,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  PAYMENT_TYPES,
  WORK_COST_MODES,
  contractRevenueBasis,
  type ContractPaymentType,
  type ContractStatus,
  type ContractWorkCostMode,
  type MilestoneInput,
} from "@/lib/contracts/constants";
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
  const currency = currencyRaw as PaymentCurrency;
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
  if (
    paymentType === "PROJECT" &&
    (!amountRaw || Number.isNaN(amount) || amount! <= 0)
  ) {
    throw new Error("Enter a valid project amount");
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
          amount: paymentType === "PROJECT" ? amount : null,
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
    deadline: new Date(deadline),
    projectName,
    description: description || null,
    currency,
    paymentType,
    amount: paymentType === "PROJECT" ? amount : null,
    status: statusRaw as ContractStatus,
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

  const created = await prisma.contract.create({
    data: {
      ...fields,
      createdByUserId,
      milestones: { create: validMilestones },
    },
  });

  await notifyContractCreated(created.id);
  await logActivity(appUser, {
    action: "created",
    entityType: "contract",
    entityId: created.id,
    summary: `Created contract "${created.projectName}"`,
    page: "contracts",
  });
  revalidatePath("/projects/contracts");
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
      teamMemberId: true,
      partnerId: true,
      projectName: true,
    },
  });

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

  if (before && before.status !== fields.status) {
    await notifyContractStatusChanged(id);
  }
  const statusNote =
    before && before.status !== fields.status
      ? ` — status ${CONTRACT_STATUS_LABELS[before.status as ContractStatus]} → ${CONTRACT_STATUS_LABELS[fields.status as ContractStatus]}`
      : "";
  await logActivity(appUser, {
    action: "updated",
    entityType: "contract",
    entityId: id,
    summary: `Edited contract "${fields.projectName}"${statusNote}`,
    page: "contracts",
  });
  if (before) {
    await notifyContractAssigned(id, {
      partner: !!fields.partnerId && fields.partnerId !== before.partnerId,
      teamMember:
        !!fields.teamMemberId && fields.teamMemberId !== before.teamMemberId,
    });
  }
  revalidatePath("/projects/contracts");
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

  revalidatePath("/projects/contracts");
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
    select: { id: true, status: true, projectName: true },
  });

  await prisma.contract.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  const changedIds = before.filter((c) => c.status !== status).map((c) => c.id);
  await Promise.all(
    changedIds.map((changedId) => notifyContractStatusChanged(changedId)),
  );
  await Promise.all(
    before
      .filter((c) => c.status !== status)
      .map((c) =>
        logActivity(appUser, {
          action: "status-changed",
          entityType: "contract",
          entityId: c.id,
          summary: `Changed contract "${c.projectName}" status ${CONTRACT_STATUS_LABELS[c.status as ContractStatus]} → ${CONTRACT_STATUS_LABELS[status]}`,
          page: "contracts",
        }),
      ),
  );

  revalidatePath("/projects/contracts");
}
