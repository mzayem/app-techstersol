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

export function currentMonthValue() {
  return monthValue(new Date());
}

/** The current month plus the `count - 1` months before it, for a "which
 * month" filter dropdown. */
export function recentMonthOptions(count = 12) {
  const now = new Date();
  const labelFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ value: monthValue(d), label: labelFmt.format(d) });
  }
  return options;
}
