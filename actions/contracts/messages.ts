"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { checkPermission, getCurrentAppUser } from "@/lib/rbac/permissions";

const MAX_MESSAGE_LENGTH = 4000;

async function authorizeContractChat(contractId: string) {
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("Not signed in");

  if (appUser.kind === "TEAM") {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { teamMemberId: true },
    });
    if (!contract || contract.teamMemberId !== appUser.teamMember?.id) {
      throw new Error("Project not found");
    }
    return appUser;
  }

  if (!checkPermission(appUser, "contracts", "view")) {
    throw new Error("You don't have access to this project");
  }
  return appUser;
}

export type ContractMessageEntry = {
  id: string;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

export async function listContractMessages(
  contractId: string,
): Promise<ContractMessageEntry[]> {
  await authorizeContractChat(contractId);

  return prisma.contractMessage.findMany({
    where: { contractId },
    select: {
      id: true,
      authorUserId: true,
      authorName: true,
      body: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createContractMessage(
  contractId: string,
  body: string,
): Promise<ContractMessageEntry> {
  const appUser = await authorizeContractChat(contractId);

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message can't be empty");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Message can't be longer than ${MAX_MESSAGE_LENGTH} characters`,
    );
  }

  const message = await prisma.contractMessage.create({
    data: {
      contractId,
      authorUserId: appUser.id,
      authorName: appUser.name,
      body: trimmed,
    },
    select: {
      id: true,
      authorUserId: true,
      authorName: true,
      body: true,
      createdAt: true,
    },
  });

  revalidatePath("/projects/contracts");
  revalidatePath("/portal/projects");
  return message;
}
