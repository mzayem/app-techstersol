import { prisma } from "@/lib/prisma";

export async function listRoles() {
  return prisma.role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listRoleOptions() {
  return prisma.role.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
