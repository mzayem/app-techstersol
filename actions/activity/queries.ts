import { prisma } from "@/lib/prisma";
import type { PageKey } from "@/lib/rbac/pages";

export type ActivityFilters = {
  search?: string;
  entityType?: string;
  page: number;
  pageSize: number;
};

/** Newest-first, paginated in the database (unlike the other listings) —
 * this table only ever grows. Entries tagged with a page the viewer's role
 * can't see are left out, so the log never leaks e.g. partner payouts to a
 * role without Partners access; untagged entries are shown to everyone
 * who can open the log. */
export async function listActivity(
  filters: ActivityFilters,
  visiblePages: PageKey[],
) {
  const where = {
    AND: [
      { OR: [{ page: null }, { page: { in: visiblePages as string[] } }] },
      filters.entityType ? { entityType: filters.entityType } : {},
      filters.search
        ? {
            OR: [
              {
                summary: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
              {
                actorName: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {},
    ],
  };

  const totalItems = await prisma.activityLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);

  const items = await prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * filters.pageSize,
    take: filters.pageSize,
  });

  return { items, page, pageSize: filters.pageSize, totalItems, totalPages };
}
