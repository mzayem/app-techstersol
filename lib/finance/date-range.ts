export const DATE_PRESETS = [
  "this-month",
  "this-year",
  "6-months",
  "custom",
  "all",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  "this-month": "This month",
  "this-year": "This year",
  "6-months": "Last 6 months",
  custom: "Custom range",
  all: "All time",
};

export type DateRange = { from?: Date; to?: Date };

export function resolveDateRange(
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
): DateRange {
  const now = new Date();

  switch (preset) {
    case "this-year":
      return { from: new Date(now.getFullYear(), 0, 1) };
    case "6-months":
      return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1) };
    case "custom":
      return {
        from: from ? new Date(from) : undefined,
        to: to ? endOfDay(new Date(to)) : undefined,
      };
    case "all":
      return {};
    case "this-month":
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
}

function endOfDay(date: Date) {
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Prisma `where` clause for a date field, given a resolved range — shared
 * so every list query filters dates the same way. `undefined` for an
 * unbounded range means "no filter", not "excludes everything". */
export function dateWhere(
  range: DateRange,
): { gte?: Date; lte?: Date } | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

/** The fiscal year running July 1 of `startYear` through June 30 of
 * `startYear + 1` (e.g. `fiscalYearRange(2025)` covers Jul 2025 – Jun
 * 2026) — Pakistan's tax year, for the Annual Report. */
export function fiscalYearRange(startYear: number): DateRange {
  return {
    from: new Date(startYear, 6, 1),
    to: endOfDay(new Date(startYear + 1, 5, 30)),
  };
}

/** "2025–26" style label for a fiscal year starting in `startYear`. */
export function formatFiscalYearLabel(startYear: number): string {
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

/** The fiscal year `date` falls in, as `startYear` (e.g. a January 2026
 * date falls in the fiscal year that started July 2025, so returns 2025). */
export function fiscalYearForDate(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
}
