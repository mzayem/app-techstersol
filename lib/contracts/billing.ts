import type { BillingCycle } from "@/lib/contracts/constants";

// All billing dates are Postgres DATEs (stored as UTC midnight), so every
// calculation here stays in UTC to avoid off-by-one-day drift.

const DAY_MS = 24 * 60 * 60 * 1000;

const CYCLE_MONTHS: Record<BillingCycle, number> = {
  WEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUALLY: 12,
};

export function startOfDayUtc(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysInMonthUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Start of the period after the one starting on `periodStart`. Monthly-
 * style cycles stay pinned to `anchorDay` (the contract's start day), so a
 * contract starting on the 31st bills on the 30th in a 30-day month and
 * goes back to the 31st after, instead of drifting earlier for good. */
export function nextPeriodStart(
  periodStart: Date,
  cycle: BillingCycle,
  anchorDay: number,
) {
  if (cycle === "WEEKLY") return addDaysUtc(periodStart, 7);
  const months = CYCLE_MONTHS[cycle];
  const year = periodStart.getUTCFullYear();
  const month = periodStart.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonthUtc(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

/** Last day of the period starting on `periodStart`, cut short at the
 * contract's end date when it falls inside the period. */
export function periodEnd(
  periodStart: Date,
  cycle: BillingCycle,
  anchorDay: number,
  endDate?: Date | null,
) {
  const end = addDaysUtc(nextPeriodStart(periodStart, cycle, anchorDay), -1);
  return endDate && endDate < end ? endDate : end;
}

/** Skips forward from `from` past every period that already ended before
 * `today` — so activating (or resuming) a contract bills the current
 * period onward, never a backlog of periods nobody was billing for. */
export function firstCurrentPeriodStart(
  from: Date,
  cycle: BillingCycle,
  anchorDay: number,
  today: Date,
) {
  let start = from;
  for (let i = 0; i < 1000; i++) {
    if (periodEnd(start, cycle, anchorDay) >= today) return start;
    start = nextPeriodStart(start, cycle, anchorDay);
  }
  return start;
}

/** The week (Monday–Sunday) or calendar month containing `date` — the
 * period an HOURLY contract's hours are logged against. */
export function hourlyPeriodFor(date: Date, cycle: BillingCycle) {
  const day = startOfDayUtc(date);
  if (cycle === "WEEKLY") {
    const weekday = day.getUTCDay(); // 0 = Sunday
    const start = addDaysUtc(day, weekday === 0 ? -6 : 1 - weekday);
    return { start, end: addDaysUtc(start, 6) };
  }
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0),
  );
  return { start, end };
}

export function formatBillingDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "01 Oct – 31 Oct 2026", or with both years when the period spans two. */
export function formatPeriod(start: Date, end: Date) {
  const short = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  return start.getUTCFullYear() === end.getUTCFullYear()
    ? `${short.format(start)} – ${formatBillingDate(end)}`
    : `${formatBillingDate(start)} – ${formatBillingDate(end)}`;
}
