export const DEFAULT_PAGE_SIZE = 15;
export const PAGE_SIZE_OPTIONS = [10, 15, 30, 50] as const;

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function parsePageSizeParam(
  value: string | string[] | undefined,
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ? n
    : DEFAULT_PAGE_SIZE;
}

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/** Slices an already-fetched, already-filtered list to one page. Pagination
 * happens here rather than in the Prisma query so pages that also derive
 * totals/running-balances/select-all state from the full list can keep
 * doing that over the unsliced array before this cuts it down for display. */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Paginated<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}
