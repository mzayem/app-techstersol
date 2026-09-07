import type { ReportCell } from "@/lib/reports/types";

/** Renders a report cell as plain text — blank (not a dash) for an empty
 * cell, since a dash reads as "zero"/"failed to load" rather than "not
 * applicable here". */
export function formatCell(value: ReportCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(value);
  }
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
}
