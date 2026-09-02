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
