"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  PAYMENT_TYPES,
  type ContractPaymentType,
  type MilestoneInput,
} from "@/lib/contracts/constants";
import { getActiveClientProfiles, getCurrentAppUser } from "@/lib/rbac/permissions";
import { validateMilestones } from "@/lib/contracts/validation";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readClientContractFields(formData: FormData, milestonesInput: MilestoneInput[]) {
  const date = str(formData, "date");
  const deadline = str(formData, "deadline");
  const projectName = str(formData, "projectName");
  const description = str(formData, "description");
  const paymentTypeRaw = str(formData, "paymentType");
  const amountRaw = str(formData, "amount");

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

  return {
    date: new Date(date),
    deadline: new Date(deadline),
    projectName,
    description: description || null,
    paymentType,
    amount: paymentType === "PROJECT" ? amount : null,
    milestones: milestoneData,
  };
}

/** A client's self-service project proposal — always lands as PROPOSED,
 * always billed in the chosen profile's own on-file currency, and never
 * assigned to a team member from here; a dashboard user promotes/assigns
 * it from the regular contract edit flow afterwards. The submitted
 * `clientId` (which profile this is for) is re-validated against the
 * signed-in login's own active profiles — never trusted from the form
 * alone, since a client with several profiles genuinely chooses one. */
export async function createClientContractRequest(
  formData: FormData,
  milestones: MilestoneInput[],
) {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.kind !== "CLIENT") {
    throw new Error("Not authorized");
  }

  const requestedClientId = str(formData, "clientId");
  const profile = getActiveClientProfiles(appUser).find((c) => c.id === requestedClientId);
  if (!profile) {
    throw new Error("Select which profile this project is for");
  }

  const { milestones: validMilestones, ...fields } = readClientContractFields(
    formData,
    milestones,
  );

  await prisma.contract.create({
    data: {
      ...fields,
      clientId: profile.id,
      currency: profile.currency,
      status: "PROPOSED",
      teamMemberId: null,
      teamPayAmount: null,
      createdByUserId: appUser.authUserId,
      milestones: { create: validMilestones },
    },
  });

  revalidatePath("/client-portal/contracts");
}
