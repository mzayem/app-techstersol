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

import {
  CURRENCY_FIELDS,
  BANK_FIELD_LABELS,
  type BankFieldKey,
} from "@/lib/bank-accounts/constants";
import type { PaymentCurrency } from "@/lib/clients/constants";
import {
  COMPANY_INFO,
  INVOICE_TERMS,
  formatInvoiceNumber,
} from "@/lib/invoices/constants";

const PAID_STAMP_DATA_URL = (() => {
  try {
    const buffer = fs.readFileSync(
      path.join(process.cwd(), "public", "images", "paid-stamp.png"),
    );
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
})();

// react-pdf can't decode WebP, so the black logo lockup is converted to PNG
// once and cached for every subsequent invoice render.
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

export type InvoicePdfData = {
  id: string;
  number: number;
  status: "UNPAID" | "PAID";
  issueDate: Date;
  dueDate: Date;
  paidOn: Date | null;
  transactionId: string | null;
  currency: PaymentCurrency;
  discount: number;
  client: { name: string; phone: string; email: string; country: string };
  bankAccount: {
    bankName: string;
    accountHolderName: string;
    accountType: string | null;
    routingNumber: string | null;
    accountNumber: string | null;
    iban: string | null;
    sortCode: string | null;
    bsbCode: string | null;
    swift: string;
  };
  items: { description: string; amount: number }[];
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
  invoiceTitle: { fontSize: 22, fontWeight: 700, color: "#111827" },
  small: { fontSize: 9, color: "#434343" },
  infoBlock: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoCol: { maxWidth: 220, gap: 4 },
  bold: { fontWeight: 700 },
  section: { marginTop: 4 },
  billTo: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  billToCol: { maxWidth: 240, gap: 4 },
  label: { fontSize: 8, fontWeight: 700, color: "#1f3864", marginBottom: 2 },
  table: {
    marginTop: 16,
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
  descCol: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    paddingRight: 6,
  },
  totalCol: { width: 90, textAlign: "right", paddingLeft: 6 },
  totalsBlock: { marginTop: 10, alignItems: "flex-end" },
  totalsRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    marginTop: 2,
  },
  balanceDue: { fontSize: 11, fontWeight: 700 },
  stampContainer: {
    position: "absolute",
    top: 180,
    left: 222,
    alignItems: "center",
  },
  stampImage: { width: 100, height: 100 },
  unpaidBadge: {
    borderWidth: 2,
    borderColor: "#dc2626",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    transform: "rotate(-8deg)",
  },
  unpaidBadgeText: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 2,
  },
  tidBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#9ca3af",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
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

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function BankBlock({
  bankAccount,
  currency,
}: {
  bankAccount: InvoicePdfData["bankAccount"];
  currency: PaymentCurrency;
}) {
  const fields = CURRENCY_FIELDS[currency];
  const values: Record<BankFieldKey, string | null> = {
    accountType: bankAccount.accountType,
    routingNumber: bankAccount.routingNumber,
    accountNumber: bankAccount.accountNumber,
    iban: bankAccount.iban,
    sortCode: bankAccount.sortCode,
    bsbCode: bankAccount.bsbCode,
  };
  return (
    <View>
      <Text>
        <Text style={styles.bold}>Bank</Text>: {bankAccount.bankName}
      </Text>
      <Text>
        <Text style={styles.bold}>{currency} Account</Text>:{" "}
        {bankAccount.accountHolderName}
      </Text>
      {fields.map((field) => (
        <Text key={field}>
          {BANK_FIELD_LABELS[field]}: {values[field]}
        </Text>
      ))}
      <Text>SWIFT: {bankAccount.swift}</Text>
    </View>
  );
}

function InvoiceDocument({
  invoice,
  qrDataUrl,
  logoDataUrl,
}: {
  invoice: InvoicePdfData;
  qrDataUrl: string;
  logoDataUrl: string | null;
}) {
  const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const balanceDue = total - invoice.discount;
  const isPaid = invoice.status === "PAID";

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
          <Text style={styles.invoiceTitle}>INVOICE</Text>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.infoCol}>
            {COMPANY_INFO.addressLines.map((line) => (
              <Text key={line} style={styles.small}>
                {line}
              </Text>
            ))}
            <Text style={styles.small}>{COMPANY_INFO.website}</Text>
            <Text style={styles.small}>{COMPANY_INFO.email}</Text>
            <Text style={styles.small}>{COMPANY_INFO.phone}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text>
              <Text style={styles.bold}>Wise ACC</Text> :{" "}
              {COMPANY_INFO.wise.handle}
            </Text>
            <Text>{COMPANY_INFO.wise.email}</Text>
            <Text>({COMPANY_INFO.wise.name})</Text>
            <View style={{ marginTop: 6 }}>
              <BankBlock
                bankAccount={invoice.bankAccount}
                currency={invoice.currency}
              />
            </View>
          </View>
        </View>

        <View style={styles.stampContainer}>
          {isPaid && PAID_STAMP_DATA_URL ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
            <Image src={PAID_STAMP_DATA_URL} style={styles.stampImage} />
          ) : (
            <View style={styles.unpaidBadge}>
              <Text style={styles.unpaidBadgeText}>UNPAID</Text>
            </View>
          )}
          {isPaid && invoice.transactionId && (
            <View style={styles.tidBox}>
              <Text style={{ fontSize: 8 }}>TID: {invoice.transactionId}</Text>
            </View>
          )}
        </View>

        <View style={styles.billTo}>
          <View style={styles.billToCol}>
            <Text style={styles.label}>BILL TO</Text>
            <Text style={styles.bold}>{invoice.client.name}</Text>
            <Text>{invoice.client.phone}</Text>
            <Text>{invoice.client.email}</Text>
            <Text>{invoice.client.country}</Text>
          </View>
          <View style={{ maxWidth: 200, gap: 4 }}>
            <Text>
              <Text style={styles.bold}>Invoice No</Text>:{" "}
              {formatInvoiceNumber(invoice.number)}
            </Text>
            <Text>
              <Text style={styles.bold}>Invoice Date</Text>:{" "}
              {formatDate(invoice.issueDate)}
            </Text>
            {isPaid && invoice.paidOn ? (
              <Text>
                <Text style={styles.bold}>Paid On</Text>:{" "}
                {formatDate(invoice.paidOn)}
              </Text>
            ) : (
              <Text>
                <Text style={styles.bold}>Due Date</Text>:{" "}
                {formatDate(invoice.dueDate)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.descCol, styles.bold]}>DESCRIPTION</Text>
            <Text style={[styles.totalCol, styles.bold]}>Total</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.descCol}>{item.description}</Text>
              <Text style={styles.totalCol}>
                {formatMoney(item.amount, invoice.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.bold}>Subtotal</Text>
            <Text>{formatMoney(total, invoice.currency)}</Text>
          </View>
          {invoice.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.bold}>Discount</Text>
              <Text>-{formatMoney(invoice.discount, invoice.currency)}</Text>
            </View>
          )}
          <View
            style={[
              styles.totalsRow,
              {
                marginTop: 6,
                paddingTop: 4,
                borderTopWidth: 1,
                borderTopColor: "#111827",
              },
            ]}
          >
            <Text style={styles.balanceDue}>Balance Due</Text>
            <Text style={styles.balanceDue}>
              {formatMoney(balanceDue, invoice.currency)}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={{ textDecoration: "underline" }}>
            Thank you for your business!
          </Text>
          <Text
            style={[styles.bold, { marginTop: 8, textDecoration: "underline" }]}
          >
            Terms & Instructions
          </Text>
          <Text style={styles.small}>{INVOICE_TERMS}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text
            style={[
              styles.small,
              { maxWidth: 340, color: "#8d8d8d", fontStyle: "italic" },
            ]}
          >
            Computer-generated receipt — no physical signature required for
            validity.
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export async function renderInvoicePdf(
  invoice: InvoicePdfData,
  origin: string,
) {
  const verifyUrl = `${origin}/verify/${invoice.id}`;
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 }),
    getLogoDataUrl(),
  ]);
  return renderToBuffer(
    <InvoiceDocument
      invoice={invoice}
      qrDataUrl={qrDataUrl}
      logoDataUrl={logoDataUrl}
    />,
  );
}
