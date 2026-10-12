// Shared by DatePicker and DateRangePicker — both store dates as ISO
// "yyyy-MM-dd" strings (matching every existing caller's form/search-param
// state), parsed to/from plain local Dates for react-day-picker.

export const DATE_DISPLAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The business runs on Pakistan time. "Today" must never come from the
 * server's clock (UTC on the host) or from Date.toISOString() (always UTC):
 * both put anything done between 00:00 and 05:00 PKT on the previous day. */
export const BUSINESS_TIME_ZONE = "Asia/Karachi";

const BUSINESS_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date in Pakistan at `instant` as "yyyy-MM-dd". Gives the
 * same answer on the server and in the browser, so a form's default date
 * never differs between the two (a hydration mismatch). */
export function businessIsoDate(instant: Date = new Date()): string {
  return BUSINESS_DATE_FORMAT.format(instant);
}

/** Today's date in Pakistan as "yyyy-MM-dd" — for form date defaults. */
export function todayIso(): string {
  return businessIsoDate();
}

/** The Pakistan calendar day containing `instant`, as the UTC-midnight
 * Date that Postgres DATE columns (dueDate, deadline…) are compared with. */
export function businessDay(instant: Date = new Date()): Date {
  return new Date(`${businessIsoDate(instant)}T00:00:00Z`);
}

/** A "yyyy-MM-dd" date shifted by `days`, in pure calendar terms (no
 * timezone involved). */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Pakistan's current year and month (1-12). */
export function businessYearMonth(instant: Date = new Date()) {
  const [year, month] = businessIsoDate(instant).split("-").map(Number);
  return { year, month };
}
