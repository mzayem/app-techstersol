/** Normalizes any date to the Monday of its week (weeks always run
 * Monday–Sunday, regardless of what day within the week is picked). */
export function mondayOf(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** The Sunday that closes out the week started by `monday`. */
export function sundayOf(monday: Date) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

export function formatWeekRange(weekStart: Date, weekEnd: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
  const year = new Intl.DateTimeFormat("en-GB", { year: "numeric" }).format(weekEnd);
  return `${fmt.format(weekStart)} – ${fmt.format(weekEnd)}, ${year}`;
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** January–December of the current calendar year only — the diary's month
 * filter deliberately doesn't offer a rolling window that bleeds into last
 * year, since "this year" already covers everything older. */
export function currentYearMonthOptions() {
  const year = new Date().getFullYear();
  const labelFmt = new Intl.DateTimeFormat("en-GB", { month: "short" });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, i, 1);
    return { value: monthValue(d), label: labelFmt.format(d) };
  });
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Resolves the work diary's period filter — "all" (unbounded), "year"
 * (the current calendar year, and the default when no period is given),
 * "custom" (an explicit from/to range), or a specific "YYYY-MM" month of
 * the current year — into a date range plus a human label for display. */
export function resolveWorkDiaryPeriod(
  period: string | undefined,
  from: string | undefined,
  to: string | undefined,
): { gte?: Date; lte?: Date; label: string } {
  const year = new Date().getFullYear();

  if (period === "all") {
    return { label: "All time" };
  }
  if (period === "custom") {
    const gte = from ? new Date(from) : undefined;
    const lte = to ? endOfDay(new Date(to)) : undefined;
    return {
      gte,
      lte,
      label: from && to ? `${from} – ${to}` : "Custom range",
    };
  }
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const gte = new Date(y, m - 1, 1);
    const lte = new Date(y, m, 0);
    const label = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(gte);
    return { gte, lte, label };
  }
  // Default, and the explicit "year" preset.
  return {
    gte: new Date(year, 0, 1),
    lte: new Date(year, 11, 31),
    label: `${year}`,
  };
}
