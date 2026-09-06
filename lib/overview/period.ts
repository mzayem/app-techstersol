export const OVERVIEW_PERIODS = ["this-year", "last-year", "custom"] as const;
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

export const OVERVIEW_PERIOD_LABELS: Record<OverviewPeriod, string> = {
  "this-year": "This year",
  "last-year": "Last year",
  custom: "Custom range",
};

export type ResolvedPeriod = { from: Date; to: Date };

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Resolves the overview's universal period selector to a concrete
 * [from, to] range. Always returns bounded dates (unlike the finance
 * pages' date-range, which allows open-ended), since every consumer here
 * needs to slice a fixed window of history. */
export function resolveOverviewPeriod(
  period: string | undefined,
  from: string | undefined,
  to: string | undefined,
): ResolvedPeriod {
  const now = new Date();

  switch (period) {
    case "last-year": {
      const year = now.getFullYear() - 1;
      return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    case "custom":
      return {
        from: from ? new Date(from) : new Date(now.getFullYear(), 0, 1),
        to: to ? endOfDay(new Date(to)) : now,
      };
    case "this-year":
    default:
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
  }
}
