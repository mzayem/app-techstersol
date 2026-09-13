import { prisma } from "@/lib/prisma";

export async function listAppUsers() {
  const users = await prisma.appUser.findMany({
    include: {
      role: { select: { id: true, name: true } },
      teamMember: { select: { id: true, name: true } },
      clientProfiles: { include: { client: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Computed here (not in the page component) so rendering stays a pure
  // function of already-resolved data instead of calling Date.now() itself.
  const now = Date.now();
  return users.map((user) => ({
    ...user,
    lockedMinutesRemaining:
      user.lockedUntil && user.lockedUntil.getTime() > now
        ? Math.max(1, Math.ceil((user.lockedUntil.getTime() - now) / 60_000))
        : null,
  }));
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
