import { prisma } from "@/lib/prisma";

export async function listAppUsers() {
  return prisma.appUser.findMany({
    include: {
      role: { select: { id: true, name: true } },
      teamMember: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
