export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Excel cell number format, e.g. "#,##0" or "dd mmm yyyy". Only used
   * when a row's value for this column is a number or Date. */
  numFmt?: string;
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
  /** Optional summary row, keyed the same as `columns`. Only include this
   * when every row's amount is in the same currency. */
  totals?: ReportRow;
  /** Column holding each row's primary date. When rows span more than one
   * calendar month, the PDF splits into a per-month table (with a year
   * divider whenever the data crosses a year boundary) instead of one long
   * flat table. Leave unset to always render a single flat table. */
  groupByDateKey?: string;
};
