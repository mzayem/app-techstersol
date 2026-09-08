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
import { getSignatureAssets } from "@/lib/reports/signature";
import type { ReactNode } from "react";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  // `lineHeight` deliberately never lives on `page` — see lib/reports/pdf.tsx
  // for why (it corrupts a fixed + position:absolute footer's placement,
  // and can crash react-pdf's pagination outright on long documents).
  body: { lineHeight: 1.45 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleBlock: { alignItems: "flex-end" },
  reportTitle: { fontSize: 17, fontWeight: 700, color: "#111827" },
  small: { fontSize: 8.5, color: "#434343" },
  subtitle: { marginTop: 4, fontSize: 9, color: "#4b5563" },
  companyBlock: { marginTop: 8, gap: 2, alignItems: "flex-end" },
  divider: {
    marginTop: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1f3864",
    marginTop: 18,
    marginBottom: 8,
  },
  paragraph: { marginBottom: 8, textAlign: "justify" },
  table: { marginTop: 4, borderWidth: 1, borderColor: "#d1d5db" },
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
  headerCellText: { fontSize: 7.5, fontWeight: 700, color: "#1f3864" },
  bold: { fontWeight: 700 },
  signBlock: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 14,
  },
  signatureImage: { width: 110, height: 42 },
  stampImage: { width: 78, height: 78 },
  signCaption: { fontSize: 8, color: "#6b7280", marginTop: 2, textAlign: "center" },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

export type AnalysisColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type AnalysisRow = Record<string, string>;

/** A modest bordered table for an analysis report's supporting figures —
 * flex-even columns (these reports are portrait, and their tables are
 * short summaries, not the wide multi-currency exports `lib/reports/pdf.tsx`
 * handles), a `fixed` header that repeats if it spans a page, and
 * `wrap={false}` rows so a page break never lands mid-row. */
export function AnalysisTable({
  columns,
  rows,
  totalsRow,
}: {
  columns: AnalysisColumn[];
  rows: AnalysisRow[];
  totalsRow?: AnalysisRow;
}) {
  function cellStyle(column: AnalysisColumn) {
    return column.align === "right" ? styles.cellRight : styles.cell;
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed minPresenceAhead={18}>
        {columns.map((column) => (
          <Text key={column.key} style={[cellStyle(column), styles.headerCellText]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.length === 0 && (
        <View style={styles.tableRow}>
          <Text style={{ ...styles.cell, color: "#6b7280" }}>No records found.</Text>
        </View>
      )}
      {rows.map((row, index) => (
        <View
          key={index}
          style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}
          wrap={false}
        >
          {columns.map((column) => (
            <Text key={column.key} style={cellStyle(column)}>
              {row[column.key] ?? ""}
            </Text>
          ))}
        </View>
      ))}
      {totalsRow && (
        <View style={styles.totalsRow} wrap={false}>
          {columns.map((column) => (
            <Text key={column.key} style={[cellStyle(column), styles.bold]}>
              {totalsRow[column.key] ?? ""}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

/** Stamp + signature, right-aligned — the same visual convention as
 * `lib/team/payslip-pdf.tsx`'s payslip PDFs, reused so every document this
 * company issues signs off the same way. Only meaningful on reports meant
 * to be a signed, official record (the Annual Report). */
export function SignatureBlock() {
  const { signature, stamp } = getSignatureAssets();
  if (!signature && !stamp) return null;
  return (
    <View style={styles.signBlock}>
      {stamp && (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
        <Image src={stamp} style={styles.stampImage} />
      )}
      <View style={{ alignItems: "center" }}>
        {signature && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
          <Image src={signature} style={styles.signatureImage} />
        )}
        <Text style={styles.signCaption}>Authorized Signature</Text>
      </View>
    </View>
  );
}

export async function renderAnalysisPdf(
  title: string,
  subtitle: string | undefined,
  generatedBy: string,
  body: ReactNode,
): Promise<Buffer> {
  const logoPng = await getReportLogoPng();
  const logoDataUrl = logoPng ? `data:image/png;base64,${logoPng.toString("base64")}` : null;
  const generatedOn = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return renderToBuffer(
    <AnalysisDocument
      title={title}
      subtitle={subtitle}
      generatedBy={generatedBy}
      generatedOn={generatedOn}
      logoDataUrl={logoDataUrl}
    >
      {body}
    </AnalysisDocument>,
  );
}

function AnalysisDocument({
  title,
  subtitle,
  generatedBy,
  generatedOn,
  logoDataUrl,
  children,
}: {
  title: string;
  subtitle?: string;
  generatedBy: string;
  generatedOn: string;
  logoDataUrl: string | null;
  children: ReactNode;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.footer} fixed>
          <Text style={[styles.small, { fontStyle: "italic" }]}>
            Generated by: {generatedBy}  ·  {generatedOn}
          </Text>
          <Text
            style={styles.small}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
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
            <View style={styles.titleBlock}>
              <Text style={styles.reportTitle}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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

          <View style={styles.divider} />

          {children}
        </View>
      </Page>
    </Document>
  );
}
