import {
  resolveDateRange,
  DATE_PRESET_LABELS,
  type DateRange,
  type DatePreset,
} from "@/lib/finance/date-range";
import type { ResolvedPeriod } from "@/lib/overview/period";

const EPOCH = new Date(2000, 0, 1);

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Analysis reports default to "this-year" (unlike the tabular exports'
 * per-module defaults) — a curated report reads oddly with no period at
 * all, so "all time" is an explicit choice here, not the fallback. */
export function resolveAnalysisRange(
  params: Record<string, string | undefined>,
): DateRange {
  return resolveDateRange(params.range ?? "this-year", params.from, params.to);
}

/** Bridges the open-ended `DateRange` the export dialogs use to the
 * bounded `ResolvedPeriod` the Overview queries expect — an unbounded
 * "from" becomes a sentinel early date, an unbounded "to" becomes now. */
export function toResolvedPeriod(range: DateRange): ResolvedPeriod {
  return { from: range.from ?? EPOCH, to: range.to ?? new Date() };
}

/** Names the active range as concretely as possible, for a report subtitle
 * and its opening narrative paragraph. */
export function periodLabel(
  params: Record<string, string | undefined>,
  range: DateRange,
): string {
  const preset = (params.range as DatePreset | undefined) ?? "this-year";
  if (preset === "this-year" && range.from) return String(range.from.getFullYear());
  if (preset === "this-month" && range.from) return MONTH_YEAR_FORMAT.format(range.from);
  if (preset === "6-months" && range.from) {
    return `${MONTH_YEAR_FORMAT.format(range.from)} – ${MONTH_YEAR_FORMAT.format(new Date())}`;
  }
  if (preset === "custom" && (range.from || range.to)) {
    return `${range.from ? DATE_FORMAT.format(range.from) : "…"} – ${range.to ? DATE_FORMAT.format(range.to) : "…"}`;
  }
  if (preset === "all") return "All time";
  return DATE_PRESET_LABELS[preset] ?? String(preset);
}
