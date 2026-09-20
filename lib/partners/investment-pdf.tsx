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
import sharp from "sharp";

import { COMPANY_INFO } from "@/lib/invoices/constants";
import {
  formatPartnerInvestmentNumber,
  INVESTMENT_METHOD_LABELS,
} from "@/lib/partners/investment-constants";
import type { InvestmentMethod } from "@/generated/prisma/client";

function readImageAsDataUrl(filename: string) {
  try {
    const buffer = fs.readFileSync(
      path.join(process.cwd(), "public", "images", filename),
    );
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
        const webpPath = path.join(
          process.cwd(),
          "public",
          "images",
          "logo-black.webp",
        );
        const pngBuffer = await sharp(webpPath).png().toBuffer();
        return `data:image/png;base64,${pngBuffer.toString("base64")}`;
      } catch {
        return null;
      }
    })();
  }
  return logoDataUrlPromise;
}

export type PartnerInvestmentPdfData = {
  id: string;
  number: number;
  date: Date;
  amount: number;
  method: InvestmentMethod;
  transactionId: string | null;
  note: string | null;
  projectName: string | null;
  partner: {
    name: string;
    phone: string | null;
    email: string | null;
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
  from: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fromCol: { maxWidth: 240, gap: 4 },
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
  signCaption: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 56,
    right: 56,
  },
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

function descriptionFor(investment: PartnerInvestmentPdfData) {
  if (investment.method === "PENDING_PAYMENT") {
    return `Converted from pending project payout${
      investment.projectName ? ` — ${investment.projectName}` : ""
    }`;
  }
  if (investment.method === "ONLINE") {
    return `Online contribution${
      investment.transactionId ? ` (TID: ${investment.transactionId})` : ""
    }`;
  }
  return "Cash contribution";
}

function InvestmentSlipDocument({
  investment,
  logoDataUrl,
}: {
  investment: PartnerInvestmentPdfData;
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
            <Text style={{ fontSize: 17, fontWeight: 700 }}>
              {COMPANY_INFO.name.toUpperCase()}
            </Text>
          )}
          <Text style={styles.title}>INVESTMENT SLIP</Text>
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

        <View style={styles.from}>
          <View style={styles.fromCol}>
            <Text style={styles.label}>RECEIVED FROM</Text>
            <Text style={styles.bold}>{investment.partner.name}</Text>
            {investment.partner.phone && (
              <Text>{investment.partner.phone}</Text>
            )}
            {investment.partner.email && (
              <Text>{investment.partner.email}</Text>
            )}
          </View>
          <View style={{ maxWidth: 220, gap: 4 }}>
            <Text>
              <Text style={styles.bold}>Slip No</Text>:{" "}
              {formatPartnerInvestmentNumber(investment.number)}
            </Text>
            <Text>
              <Text style={styles.bold}>Date</Text>:{" "}
              {formatDate(investment.date)}
            </Text>
            <Text>
              <Text style={styles.bold}>Method</Text>:{" "}
              {INVESTMENT_METHOD_LABELS[investment.method]}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.descCol, styles.bold]}>DESCRIPTION</Text>
            <Text style={[styles.amountCol, styles.bold]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.descCol}>
              {descriptionFor(investment)}
              {investment.note ? `\n${investment.note}` : ""}
            </Text>
            <Text style={styles.amountCol}>
              {formatPkr(investment.amount)}
            </Text>
          </View>
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.amountDue}>Amount Invested</Text>
            <Text style={styles.amountDue}>
              {formatPkr(investment.amount)}
            </Text>
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
          <Text
            style={[
              styles.small,
              { color: "#8d8d8d", fontStyle: "italic" },
            ]}
          >
            Computer-generated investment slip — proof of contribution to
            your investment balance with {COMPANY_INFO.name}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPartnerInvestmentPdf(
  investment: PartnerInvestmentPdfData,
) {
  const logoDataUrl = await getLogoDataUrl();
  return renderToBuffer(
    <InvestmentSlipDocument investment={investment} logoDataUrl={logoDataUrl} />,
  );
}
