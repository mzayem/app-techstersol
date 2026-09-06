import fs from "node:fs";
import path from "node:path";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import sharp from "sharp";

import { COMPANY_INFO } from "@/lib/invoices/constants";
import { formatPayslipNumber } from "@/lib/team/constants";

function readImageAsDataUrl(filename: string) {
  try {
    const buffer = fs.readFileSync(path.join(process.cwd(), "public", "images", filename));
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

const SIGNATURE_DATA_URL = readImageAsDataUrl("slip_sign.png");
const STAMP_DATA_URL = readImageAsDataUrl("digital_stamp.png");

let logoDataUrlPromise: Promise<string | null> | null = null;
function getLogoDataUrl(): Promise<string | null> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = (async () => {
      try {
        const webpPath = path.join(process.cwd(), "public", "images", "logo-black.webp");
        const pngBuffer = await sharp(webpPath).png().toBuffer();
        return `data:image/png;base64,${pngBuffer.toString("base64")}`;
      } catch {
        return null;
      }
    })();
  }
  return logoDataUrlPromise;
}

export type PayslipPdfData = {
  id: string;
  number: number;
  periodStart: Date;
  periodEnd: Date;
  issueDate: Date;
  amount: number;
  note: string | null;
  projectName: string | null;
  teamMember: {
    name: string;
    phone: string | null;
    email: string | null;
    country: string | null;
    address: string | null;
  };
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 56,
    fontSize: 9.5,
    lineHeight: 1.5,
    fontFamily: "Helvetica",
    color: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 22, fontWeight: 700, color: "#111827" },
  small: { fontSize: 9, color: "#434343" },
  bold: { fontWeight: 700 },
  infoBlock: { marginTop: 16, gap: 4 },
  payTo: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  payToCol: { maxWidth: 240, gap: 4 },
  label: { fontSize: 8, fontWeight: 700, color: "#1f3864", marginBottom: 2 },
  table: {
    marginTop: 20,
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
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  descCol: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    paddingRight: 6,
  },
  amountCol: { width: 110, textAlign: "right", paddingLeft: 6 },
  totalsBlock: { marginTop: 10, alignItems: "flex-end" },
  totalsRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginTop: 2,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  amountDue: { fontSize: 12, fontWeight: 700 },
  signBlock: {
    marginTop: 50,
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
    bottom: 30,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verifyGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
});

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatPkr(amount: number) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} PKR`;
}

function PayslipDocument({
  payslip,
  qrDataUrl,
  logoDataUrl,
}: {
  payslip: PayslipPdfData;
  qrDataUrl: string;
  logoDataUrl: string | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {logoDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
            <Image src={logoDataUrl} style={{ width: 150, height: 30 }} />
          ) : (
            <Text style={{ fontSize: 17, fontWeight: 700 }}>{COMPANY_INFO.name.toUpperCase()}</Text>
          )}
          <Text style={styles.title}>PAYSLIP</Text>
        </View>

        <View style={styles.infoBlock}>
          {COMPANY_INFO.addressLines.map((line) => (
            <Text key={line} style={styles.small}>
              {line}
            </Text>
          ))}
          <Text style={styles.small}>{COMPANY_INFO.website}</Text>
          <Text style={styles.small}>{COMPANY_INFO.email}</Text>
          <Text style={styles.small}>{COMPANY_INFO.phone}</Text>
        </View>

        <View style={styles.payTo}>
          <View style={styles.payToCol}>
            <Text style={styles.label}>PAY TO</Text>
            <Text style={styles.bold}>{payslip.teamMember.name}</Text>
            {payslip.teamMember.phone && <Text>{payslip.teamMember.phone}</Text>}
            {payslip.teamMember.email && <Text>{payslip.teamMember.email}</Text>}
            {payslip.teamMember.address && <Text>{payslip.teamMember.address}</Text>}
            {payslip.teamMember.country && <Text>{payslip.teamMember.country}</Text>}
          </View>
          <View style={{ maxWidth: 220, gap: 4 }}>
            <Text>
              <Text style={styles.bold}>Payslip No</Text>: {formatPayslipNumber(payslip.number)}
            </Text>
            <Text>
              <Text style={styles.bold}>Issue Date</Text>: {formatDate(payslip.issueDate)}
            </Text>
            <Text>
              <Text style={styles.bold}>Period</Text>: {formatDate(payslip.periodStart)} –{" "}
              {formatDate(payslip.periodEnd)}
            </Text>
            {payslip.projectName && (
              <Text>
                <Text style={styles.bold}>Project</Text>: {payslip.projectName}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.descCol, styles.bold]}>DESCRIPTION</Text>
            <Text style={[styles.amountCol, styles.bold]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.descCol}>
              Payment for services rendered ({formatDate(payslip.periodStart)} –{" "}
              {formatDate(payslip.periodEnd)})
              {payslip.note ? `\n${payslip.note}` : ""}
            </Text>
            <Text style={styles.amountCol}>{formatPkr(payslip.amount)}</Text>
          </View>
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.amountDue}>Amount Paid</Text>
            <Text style={styles.amountDue}>{formatPkr(payslip.amount)}</Text>
          </View>
        </View>

        <View style={styles.signBlock}>
          {STAMP_DATA_URL && (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
            <Image src={STAMP_DATA_URL} style={styles.stampImage} />
          )}
          <View style={{ alignItems: "center" }}>
            {SIGNATURE_DATA_URL && (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
              <Image src={SIGNATURE_DATA_URL} style={styles.signatureImage} />
            )}
            <Text style={styles.signCaption}>Authorized Signature</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={[styles.small, { maxWidth: 340, color: "#8d8d8d", fontStyle: "italic" }]}>
            Computer-generated payslip — no physical signature required for validity.
          </Text>
          <View style={styles.verifyGroup}>
            <Text style={styles.bold}>E-Verify</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img> */}
            <Image src={qrDataUrl} style={{ width: 50, height: 50 }} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPayslipPdf(payslip: PayslipPdfData, origin: string) {
  const verifyUrl = `${origin}/verify/payslip/${payslip.id}`;
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 }),
    getLogoDataUrl(),
  ]);
  return renderToBuffer(
    <PayslipDocument payslip={payslip} qrDataUrl={qrDataUrl} logoDataUrl={logoDataUrl} />,
  );
}
