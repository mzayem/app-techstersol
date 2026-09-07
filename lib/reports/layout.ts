import { formatCell } from "@/lib/reports/format";
import type { ReportColumn, ReportRow } from "@/lib/reports/types";

export type PageOrientation = "portrait" | "landscape";

// Standard A4 size in points, minus the report's own horizontal page
// padding (`paddingHorizontal: 40` on both sides, see pdf.tsx's `page`
// style) — the actual width available to the table.
const A4_WIDTH_PT = { portrait: 595.28, landscape: 841.89 };
const PAGE_PADDING_HORIZONTAL = 40;

const HEADER_FONT_SIZE = 8;
const BODY_FONT_SIZE = 9;
// Helvetica's average advance width, in ems — a workable heuristic for
// sizing columns without loading real font metrics.
const CHAR_WIDTH_FACTOR = 0.56;
const CELL_PADDING = 14;
const MIN_COLUMN_WIDTH = 42;
// A flexible (free-text) column reads poorly under this width, so the
// orientation check reserves at least this much per flexible column
// before concluding portrait has room to spare.
const MIN_FLEXIBLE_WIDTH = 90;
const MAX_COLUMNS_BEFORE_LANDSCAPE = 8;

export function contentWidthFor(orientation: PageOrientation): number {
  return A4_WIDTH_PT[orientation] - PAGE_PADDING_HORIZONTAL * 2;
}

function isFlexibleColumn(column: ReportColumn): boolean {
  return column.flexible === true;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_FACTOR;
}

/** Measures a fixed (non-flexible) column's needed width from its own
 * content: the header label and the longest formatted value across the
 * rows and totals — regardless of whether that value is a number, a date,
 * or a short bounded-vocabulary string (a status label, an amount already
 * formatted with a currency symbol, an id). */
function computeFixedColumnWidth(
  column: ReportColumn,
  rows: ReportRow[],
  totals: ReportRow | undefined,
): number {
  const headerWidth = estimateTextWidth(column.label, HEADER_FONT_SIZE);
  let maxDataWidth = 0;
  for (const row of rows) {
    const width = estimateTextWidth(formatCell(row[column.key]), BODY_FONT_SIZE);
    if (width > maxDataWidth) maxDataWidth = width;
  }
  if (totals) {
    const width = estimateTextWidth(formatCell(totals[column.key]), BODY_FONT_SIZE);
    if (width > maxDataWidth) maxDataWidth = width;
  }
  return Math.max(MIN_COLUMN_WIDTH, Math.ceil(Math.max(headerWidth, maxDataWidth) + CELL_PADDING));
}

/** Picks portrait unless the report has too many columns, or its
 * non-flexible columns alone (plus a sane minimum for each flexible one)
 * wouldn't leave enough room to be legible on an A4 portrait page. */
export function chooseOrientation(
  columns: ReportColumn[],
  rows: ReportRow[],
  totals?: ReportRow,
): PageOrientation {
  if (columns.length > MAX_COLUMNS_BEFORE_LANDSCAPE) return "landscape";

  let fixedTotal = 0;
  let flexibleCount = 0;
  for (const column of columns) {
    if (isFlexibleColumn(column)) flexibleCount += 1;
    else fixedTotal += computeFixedColumnWidth(column, rows, totals);
  }

  const reservedForFlexible = flexibleCount * MIN_FLEXIBLE_WIDTH;
  return fixedTotal + reservedForFlexible > contentWidthFor("portrait") ? "landscape" : "portrait";
}

/** Final per-column widths for the given content width: fixed columns get
 * exactly what `computeFixedColumnWidth` measured; flexible columns split
 * whatever's left over, weighted by `flexWeight`. Rounding drift lands on
 * the last column so the row always sums to exactly `contentWidth`. */
export function computeColumnWidths(
  columns: ReportColumn[],
  rows: ReportRow[],
  totals: ReportRow | undefined,
  contentWidth: number,
): number[] {
  const fixedWidths: (number | null)[] = columns.map((column) =>
    isFlexibleColumn(column) ? null : computeFixedColumnWidth(column, rows, totals),
  );

  const usedWidth = fixedWidths.reduce((sum: number, w) => sum + (w ?? 0), 0);
  const remaining = Math.max(contentWidth - usedWidth, 0);

  const flexibleIndices = columns.map((_, i) => i).filter((i) => fixedWidths[i] === null);
  const totalWeight =
    flexibleIndices.reduce((sum, i) => sum + (columns[i].flexWeight ?? 1), 0) || 1;

  const widths = columns.map((column, i) => {
    if (fixedWidths[i] !== null) return fixedWidths[i]!;
    const weight = column.flexWeight ?? 1;
    return Math.max(MIN_COLUMN_WIDTH, (remaining * weight) / totalWeight);
  });

  const drift = contentWidth - widths.reduce((sum, w) => sum + w, 0);
  if (Math.abs(drift) > 0.01) widths[widths.length - 1] += drift;

  return widths;
}
