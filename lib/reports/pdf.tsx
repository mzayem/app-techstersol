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
import { groupRowsByMonth, computeGroupTotals } from "@/lib/reports/group";
import type { ReportSpec, ReportCell, ReportColumn, ReportRow } from "@/lib/reports/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontSize: 9,
    lineHeight: 1.4,
    fontFamily: "Helvetica",
    color: "#000000",
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
  cell: { flex: 1, paddingRight: 6 },
  cellRight: { flex: 1, paddingRight: 6, textAlign: "right" },
  headerCellText: { fontSize: 8, fontWeight: 700, color: "#1f3864" },
  bold: { fontWeight: 700 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

function cellAlign(column: ReportColumn) {
  return column.align === "right" ? styles.cellRight : styles.cell;
}

function formatCell(value: ReportCell): string {
  if (value === null || value === undefined) return "—";
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

/** One bordered table: header row (repeats on every page it flows onto),
 * body rows, and an optional totals row. */
function ReportTable({
  columns,
  rows,
  totalsRow,
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
  totalsRow?: ReportRow;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        {columns.map((column) => (
          <Text key={column.key} style={[cellAlign(column), styles.headerCellText]}>
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
          {columns.map((column) => (
            <Text key={column.key} style={cellAlign(column)}>
              {formatCell(row[column.key])}
            </Text>
          ))}
        </View>
      ))}
      {totalsRow && (
        <View style={styles.totalsRow} wrap={false}>
          {columns.map((column) => (
            <Text key={column.key} style={[cellAlign(column), styles.bold]}>
              {formatCell(totalsRow[column.key])}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ReportDocument({
  spec,
  logoDataUrl,
  generatedOn,
}: {
  spec: ReportSpec;
  logoDataUrl: string | null;
  generatedOn: string;
}) {
  const groups = spec.groupByDateKey
    ? groupRowsByMonth(spec.rows, spec.groupByDateKey)
    : null;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
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
          groups.map((group, index) => (
            <View key={index}>
              {group.yearDivider && (
                <Text style={styles.yearHeading}>{group.yearDivider}</Text>
              )}
              <Text style={styles.groupHeading}>{group.periodLabel}</Text>
              <ReportTable
                columns={spec.columns}
                rows={group.rows}
                totalsRow={
                  spec.totals ? computeGroupTotals(group.rows, spec.totals) : undefined
                }
              />
            </View>
          ))
        ) : (
          <ReportTable columns={spec.columns} rows={spec.rows} totalsRow={spec.totals} />
        )}

        <View style={styles.footer} fixed>
          <Text style={[styles.small, { fontStyle: "italic" }]}>
            Generated on {generatedOn} — {COMPANY_INFO.name}
          </Text>
          <Text
            style={styles.small}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(spec: ReportSpec): Promise<Buffer> {
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
      generatedOn={generatedOn}
    />,
  );
}
