"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  checkPermission,
  getActiveClientProfiles,
  getCurrentAppUser,
} from "@/lib/rbac/permissions";
import { notifyChatMessage } from "@/lib/mail/notifications/contracts";

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

  if (appUser.kind === "CLIENT") {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { clientId: true },
    });
    const activeClientIds = getActiveClientProfiles(appUser).map((c) => c.id);
    if (!contract || !activeClientIds.includes(contract.clientId)) {
      throw new Error("Project not found");
    }
    return appUser;
  }

  if (appUser.kind === "PARTNER") {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { partnerId: true },
    });
    if (!contract || contract.partnerId !== appUser.partner?.id) {
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
  isMine: boolean;
  authorName: string;
  body: string;
  createdAt: Date;
};

export async function listContractMessages(
  contractId: string,
): Promise<ContractMessageEntry[]> {
  const appUser = await authorizeContractChat(contractId);

  const messages = await prisma.contractMessage.findMany({
    where: { contractId },
    select: {
      id: true,
      authorUserId: true,
      authorName: true,
      authorKind: true,
      body: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return messages.map(({ authorUserId, authorKind, ...m }) => ({
    ...m,
    isMine: authorUserId === appUser.id,
    authorName:
      appUser.kind === "TEAM" && authorKind === "CLIENT"
        ? "Client"
        : m.authorName,
  }));
}

export async function createContractMessage(
  contractId: string,
  body: string,
): Promise<ContractMessageEntry> {
  const appUser = await authorizeContractChat(contractId);
  if (appUser.kind === "TEAM") {
    throw new Error(
      "Team members can view this project's chat but can't post messages",
    );
  }
  if (appUser.kind === "PARTNER" && !appUser.partner?.chatEnabled) {
    throw new Error(
      "Chat isn't enabled for your account yet — ask an admin to turn it on",
    );
  }

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
      authorKind: appUser.kind,
      body: trimmed,
    },
    select: {
      id: true,
      authorName: true,
      body: true,
      createdAt: true,
    },
  });

  await notifyChatMessage({
    contractId,
    authorKind: appUser.kind,
    authorLabel: appUser.name,
    message: trimmed,
  });

  revalidatePath("/projects/contracts");
  revalidatePath("/portal/projects");
  revalidatePath("/client-portal/contracts");
  revalidatePath("/partner-portal/projects");
  return { ...message, isMine: true };
}

export async function deleteContractMessage(
  contractId: string,
  messageId: string,
): Promise<void> {
  const appUser = await authorizeContractChat(contractId);

  const message = await prisma.contractMessage.findUnique({
    where: { id: messageId },
    select: { contractId: true, authorUserId: true },
  });
  if (!message || message.contractId !== contractId) {
    throw new Error("Message not found");
  }
  if (message.authorUserId !== appUser.id) {
    throw new Error("You can only delete your own messages");
  }

  await prisma.contractMessage.delete({ where: { id: messageId } });

  revalidatePath("/projects/contracts");
  revalidatePath("/portal/projects");
  revalidatePath("/client-portal/contracts");
  revalidatePath("/partner-portal/projects");
}
