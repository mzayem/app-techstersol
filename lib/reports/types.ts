export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Excel cell number format, e.g. "#,##0" or "dd mmm yyyy". Only used
   * when a row's value for this column is a number or Date. */
  numFmt?: string;
  /** Marks this as a free-text/description column (e.g. "Name", "Client",
   * "Project") — the PDF sizes every other column tightly to its own
   * content (dates, amounts, status labels, ids — even when their values
   * are strings rather than numbers) and gives whatever's left over to
   * the flexible columns, split by `flexWeight` (default 1). Give the
   * most important one a higher weight so it reads bigger than the rest. */
  flexible?: boolean;
  flexWeight?: number;
};

export type ReportCell = string | number | Date | null;
export type ReportRow = Record<string, ReportCell>;

export type ReportSpec = {
  /** Big title printed next to the logo, e.g. "EARNING REPORT". */
  title: string;
  /** Shown under the title — active date range / filter description. */
  subtitle?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportRow;
  groupByDateKey?: string;
  summaryNoun?: string;
};
