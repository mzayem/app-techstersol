import { prisma } from "@/lib/prisma";

export async function listAppUsers() {
  return prisma.appUser.findMany({
    include: {
      role: { select: { id: true, name: true } },
      teamMember: { select: { id: true, name: true } },
      clientProfiles: { include: { client: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Clients with no login yet — the only ones offered when creating a new
 * client login (a Client should only ever back one login). Pass
 * `excludeAppUserId` when editing an existing login so that login's own
 * currently-linked profiles still show up as selectable alongside the
 * unclaimed ones. */
export async function listAvailableClientOptions(excludeAppUserId?: string) {
  return prisma.client.findMany({
    where: {
      clientProfiles: {
        none: excludeAppUserId ? { appUserId: { not: excludeAppUserId } } : {},
      },
    },
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });
}
