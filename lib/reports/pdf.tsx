import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

import { COMPANY_INFO } from "@/lib/invoices/constants";
import { getReportLogoPng } from "@/lib/reports/logo";
import { formatCell } from "@/lib/reports/format";
import {
  groupRowsByMonth,
  computeGroupTotals,
  partitionIntoYearSections,
  chronologicalBounds,
} from "@/lib/reports/group";
import {
  chooseOrientation,
  computeColumnWidths,
  contentWidthFor,
  type PageOrientation,
} from "@/lib/reports/layout";
import type { ReportSpec, ReportColumn, ReportRow } from "@/lib/reports/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#000000",
  },
  // `lineHeight` lives here rather than on `page` — react-pdf's pagination
  // engine miscomputes a `fixed` + `position: absolute` child's placement
  // (throwing "unsupported number" on some page counts, or silently
  // dropping its text on others) when the Page itself has a lineHeight
  // other than the default. Scoping it to the flowing content only avoids
  // that, since the footer sits outside this wrapper.
  body: {
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reportTitle: { fontSize: 18, fontWeight: 700, color: "#111827" },
  small: { fontSize: 8.5, color: "#434343" },
  companyBlock: { marginTop: 10, gap: 2 },
  subtitle: { marginTop: 6, fontSize: 9, color: "#4b5563" },
  yearHeading: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: 700,
    color: "#111827",
  },
  groupHeading: {
    marginTop: 14,
    marginBottom: 2,
    fontSize: 10.5,
    fontWeight: 700,
    color: "#1f3864",
  },
  table: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    backgroundColor: "#f3f4f6",
  },
  cell: { paddingRight: 6 },
  cellRight: { paddingRight: 6, textAlign: "right" },
  headerCellText: { fontSize: 8, fontWeight: 700, color: "#1f3864" },
  bold: { fontWeight: 700 },
  summaryBox: {
    marginTop: 10,
    marginBottom: 4,
    padding: 8,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 3,
  },
  summaryText: { fontSize: 9.5, fontWeight: 700, color: "#1e3a8a" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

function cellStyle(column: ReportColumn, width: number) {
  return [column.align === "right" ? styles.cellRight : styles.cell, { width }];
}

/** One bordered table: header row (repeats on every page it flows onto),
 * body rows, and an optional totals row. `columnWidths` is parallel to
 * `columns` — computed once per report by `layout.ts` from actual column
 * content, not an even flex split. */
function ReportTable({
  columns,
  columnWidths,
  rows,
  totalsRow,
}: {
  columns: ReportColumn[];
  columnWidths: number[];
  rows: ReportRow[];
  totalsRow?: ReportRow;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed minPresenceAhead={20}>
        {columns.map((column, i) => (
          <Text key={column.key} style={[cellStyle(column, columnWidths[i]), styles.headerCellText]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.length === 0 && (
        <View style={styles.tableRow}>
          <Text style={{ ...styles.cell, color: "#6b7280" }}>
            No records found for this selection.
          </Text>
        </View>
      )}
      {rows.map((row, index) => (
        <View
          key={index}
          style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}
          wrap={false}
        >
          {columns.map((column, i) => (
            <Text key={column.key} style={cellStyle(column, columnWidths[i])}>
              {formatCell(row[column.key])}
            </Text>
          ))}
        </View>
      ))}
      {totalsRow && (
        <View style={styles.totalsRow} wrap={false}>
          {columns.map((column, i) => (
            <Text key={column.key} style={[cellStyle(column, columnWidths[i]), styles.bold]}>
              {formatCell(totalsRow[column.key])}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** "Total earning from January 2026 to September 2026: 1,234,567 · Team
 * pay: … · Net earning: …" — one sentence per report section (the whole
 * report, or one calendar year when the data spans more than one). The
 * first numeric column in `spec.columns` is the headline figure; any
 * other numeric columns follow using their own table label. Returns null
 * when the report doesn't opt into totals/a summary noun. */
function buildSummarySentence(
  spec: ReportSpec,
  rows: ReportRow[],
  fromLabel: string,
  toLabel: string,
): string | null {
  if (!spec.totals || !spec.summaryNoun) return null;
  const totals = computeGroupTotals(rows, spec.totals);
  const numericColumns = spec.columns.filter(
    (column) => typeof totals[column.key] === "number",
  );
  if (numericColumns.length === 0) return null;

  const [primary, ...secondary] = numericColumns;
  const span = fromLabel === toLabel ? `for ${fromLabel}` : `from ${fromLabel} to ${toLabel}`;
  const parts = [`Total ${spec.summaryNoun} ${span}: ${formatCell(totals[primary.key])}`];
  for (const column of secondary) {
    parts.push(`${column.label}: ${formatCell(totals[column.key])}`);
  }
  return parts.join("   ·   ");
}

function ReportDocument({
  spec,
  logoDataUrl,
  generatedBy,
  generatedOn,
}: {
  spec: ReportSpec;
  logoDataUrl: string | null;
  generatedBy: string;
  generatedOn: string;
}) {
  const groups = spec.groupByDateKey
    ? groupRowsByMonth(spec.rows, spec.groupByDateKey)
    : null;
  const orientation: PageOrientation = chooseOrientation(spec.columns, spec.rows, spec.totals);
  const columnWidths = computeColumnWidths(
    spec.columns,
    spec.rows,
    spec.totals,
    contentWidthFor(orientation),
  );

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <View style={styles.footer} fixed>
          <Text style={[styles.small, { fontStyle: "italic" }]}>
            Generated by: {generatedBy}  ·  {generatedOn}
          </Text>
          <Text
            style={styles.small}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            {logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
              <Image src={logoDataUrl} style={{ width: 150, height: 30 }} />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: 700 }}>
                {COMPANY_INFO.name.toUpperCase()}
              </Text>
            )}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.reportTitle}>{spec.title}</Text>
              <View style={styles.companyBlock}>
                {COMPANY_INFO.addressLines.map((line) => (
                  <Text key={line} style={styles.small}>
                    {line}
                  </Text>
                ))}
                <Text style={styles.small}>{COMPANY_INFO.website}</Text>
              </View>
            </View>
          </View>

          {spec.subtitle && <Text style={styles.subtitle}>{spec.subtitle}</Text>}

          {groups ? (
            partitionIntoYearSections(groups).map((section, sectionIndex) => {
              const sectionRows = section.flatMap((group) => group.rows);
              const { first, last } = chronologicalBounds(section);
              const summary = buildSummarySentence(
                spec,
                sectionRows,
                first.periodLabel,
                last.periodLabel,
              );
              return (
                <View key={sectionIndex}>
                  {section.map((group, groupIndex) => (
                    <View key={groupIndex}>
                      {group.yearDivider && (
                        <Text style={styles.yearHeading}>{group.yearDivider}</Text>
                      )}
                      <Text style={styles.groupHeading}>{group.periodLabel}</Text>
                      <ReportTable
                        columns={spec.columns}
                        columnWidths={columnWidths}
                        rows={group.rows}
                        totalsRow={
                          spec.totals ? computeGroupTotals(group.rows, spec.totals) : undefined
                        }
                      />
                    </View>
                  ))}
                  {summary && (
                    <View style={styles.summaryBox} wrap={false}>
                      <Text style={styles.summaryText}>{summary}</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <ReportTable
              columns={spec.columns}
              columnWidths={columnWidths}
              rows={spec.rows}
              totalsRow={spec.totals}
            />
          )}
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(
  spec: ReportSpec,
  options: { generatedBy: string },
): Promise<Buffer> {
  const logoPng = await getReportLogoPng();
  const logoDataUrl = logoPng
    ? `data:image/png;base64,${logoPng.toString("base64")}`
    : null;
  const generatedOn = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return renderToBuffer(
    <ReportDocument
      spec={spec}
      logoDataUrl={logoDataUrl}
      generatedBy={options.generatedBy}
      generatedOn={generatedOn}
    />,
  );
}
