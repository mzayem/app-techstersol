import type { ReportRow } from "@/lib/reports/types";

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

export type ReportGroup = {
  /** Calendar year to print as a divider before this group — only set on
   * the first group of each year, and only when the data spans more than
   * one year. */
  yearDivider?: string;
  periodLabel: string;
  rows: ReportRow[];
  /** Epoch ms for this group's month, for chronological sort — `rows`
   * follows whatever display sort the caller applied (often newest
   * first), so group *order* can't be trusted to mean chronological
   * order. */
  sortKey: number;
};

/** Splits rows into one group per calendar month (in the order they first
 * appear, so it follows whatever sort the caller already applied), with a
 * year divider inserted whenever the data crosses a year boundary. Returns
 * null when everything falls in the same calendar month — the caller then
 * renders a single flat table instead. */
export function groupRowsByMonth(rows: ReportRow[], dateKey: string): ReportGroup[] | null {
  const dates = rows
    .map((row) => row[dateKey])
    .filter((value): value is Date => value instanceof Date);
  if (dates.length === 0) return null;

  const times = dates.map((date) => date.getTime());
  const minDate = new Date(Math.min(...times));
  const maxDate = new Date(Math.max(...times));
  const sameMonth =
    minDate.getFullYear() === maxDate.getFullYear() &&
    minDate.getMonth() === maxDate.getMonth();
  if (sameMonth) return null;

  const spansMultipleYears = minDate.getFullYear() !== maxDate.getFullYear();

  const order: string[] = [];
  const buckets = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const date = row[dateKey];
    const key =
      date instanceof Date
        ? `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`
        : "unspecified";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(row);
  }

  let previousYear: number | null = null;
  return order.map((key) => {
    const groupRows = buckets.get(key)!;
    const sample = groupRows
      .map((row) => row[dateKey])
      .find((value): value is Date => value instanceof Date);
    const periodLabel = sample ? MONTH_YEAR_FORMAT.format(sample) : "Unspecified date";
    const year = sample?.getFullYear() ?? null;
    const yearDivider =
      spansMultipleYears && year !== null && year !== previousYear ? String(year) : undefined;
    previousYear = year;
    return { yearDivider, periodLabel, rows: groupRows, sortKey: sample?.getTime() ?? 0 };
  });
}

/** The chronologically first and last group in a section — independent of
 * the section's own array order, which follows the rows' display sort
 * (e.g. newest-first) rather than calendar order. */
export function chronologicalBounds(groups: ReportGroup[]): { first: ReportGroup; last: ReportGroup } {
  const sorted = [...groups].sort((a, b) => a.sortKey - b.sortKey);
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

/** Splits an ordered list of month-groups into one section per calendar
 * year — a section boundary falls wherever `yearDivider` is set (which
 * `groupRowsByMonth` only does when the data actually crosses a year
 * boundary), so a single-year report comes back as one section covering
 * every group. */
export function partitionIntoYearSections(groups: ReportGroup[]): ReportGroup[][] {
  const sections: ReportGroup[][] = [];
  let current: ReportGroup[] = [];
  groups.forEach((group, index) => {
    if (index > 0 && group.yearDivider) {
      sections.push(current);
      current = [];
    }
    current.push(group);
  });
  if (current.length > 0) sections.push(current);
  return sections;
}

/** Builds a subtotal row for one group, shaped like `totalsTemplate`: sums
 * whichever columns hold a number there, reuses its label there (as
 * "Subtotal" instead of the template's own label), and leaves the rest
 * blank — so callers don't need to special-case which columns are
 * summable per report. */
export function computeGroupTotals(rows: ReportRow[], totalsTemplate: ReportRow): ReportRow {
  const result: ReportRow = {};
  for (const [key, templateValue] of Object.entries(totalsTemplate)) {
    if (typeof templateValue === "number") {
      result[key] = rows.reduce((sum, row) => {
        const value = row[key];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    } else if (typeof templateValue === "string") {
      result[key] = "Subtotal";
    } else {
      result[key] = null;
    }
  }
  return result;
}
