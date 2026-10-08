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

import { prisma } from "@/lib/prisma";
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_UNITS,
  contractAmountLabel,
  contractStatusLabel,
  type BillingCycle,
} from "@/lib/contracts/constants";
import { formatBillingDate } from "@/lib/contracts/billing";
import { formatContractNumber } from "@/lib/contracts/numbering-format";
import { COMPANY_INFO } from "@/lib/invoices/constants";
import { getLogoDataUrl } from "@/lib/invoices/pdf";

export async function getAgreementContract(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      number: true,
      status: true,
      projectName: true,
      description: true,
      date: true,
      deadline: true,
      currency: true,
      paymentType: true,
      amount: true,
      billingCycle: true,
      invoiceDueDays: true,
      terms: true,
      clientId: true,
      partnerId: true,
      client: { select: { name: true } },
      milestones: { select: { amount: true } },
    },
  });
}

type AgreementContract = NonNullable<
  Awaited<ReturnType<typeof getAgreementContract>>
>;

/** Public page the agreement's QR code points at — confirms the agreement
 * is genuine and shows the contract's live status. */
export function agreementVerifyUrl(contractId: string, origin: string) {
  return `${origin}/verify/contract/${contractId}`;
}

export function agreementFilename(contract: {
  number: number;
  projectName: string;
}) {
  const slug = contract.projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `service-agreement-${contract.number}-${slug || "contract"}.pdf`;
}

function billingLine(contract: AgreementContract) {
  const cycle = contract.billingCycle as BillingCycle | null;
  const amount = contractAmountLabel(contract);
  if (contract.paymentType === "RECURRING" && cycle) {
    return `${amount}, invoiced ${BILLING_CYCLE_LABELS[cycle].toLowerCase()} at the start of each billing ${BILLING_CYCLE_UNITS[cycle]}`;
  }
  if (contract.paymentType === "HOURLY" && cycle) {
    return `${amount}, with hours worked invoiced ${BILLING_CYCLE_LABELS[cycle].toLowerCase()}`;
  }
  return amount;
}

// Header and footer mirror lib/invoices/pdf.tsx (logo + title, company
// details, and the E-Verify QR footer); the body is a plain letter.
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 90,
    paddingHorizontal: 56,
    fontSize: 10,
    lineHeight: 1.6,
    fontFamily: "Helvetica",
    color: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 20, fontWeight: 700, color: "#111827" },
  small: { fontSize: 9, color: "#434343" },
  infoBlock: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoCol: { maxWidth: 220, gap: 4 },
  bold: { fontWeight: 700 },
  body: { marginTop: 28 },
  paragraph: { marginBottom: 8 },
  list: { marginBottom: 8, paddingLeft: 8 },
  listItem: { flexDirection: "row", marginBottom: 2 },
  bullet: { width: 12 },
  listText: { flex: 1 },
  heading: { fontWeight: 700, marginTop: 4, marginBottom: 4 },
  signOff: { marginTop: 18, gap: 2 },
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.listItem}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.listText}>
        <Text style={styles.bold}>{label}:</Text> {value}
      </Text>
    </View>
  );
}

function AgreementDocument({
  contract,
  qrDataUrl,
  logoDataUrl,
}: {
  contract: AgreementContract;
  qrDataUrl: string;
  logoDataUrl: string | null;
}) {
  const client = contract.client.name;
  const isRecurring = contract.paymentType === "RECURRING";
  const openEnded = isRecurring || contract.paymentType === "HOURLY";
  const terms = (contract.terms ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

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
          <Text style={styles.title}>
            {isRecurring ? "SERVICE AGREEMENT" : "ENGAGEMENT LETTER"}
          </Text>
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
              <Text style={styles.bold}>Contract No</Text>:{" "}
              {formatContractNumber(contract.number)}
            </Text>
            <Text>
              <Text style={styles.bold}>Date</Text>:{" "}
              {formatBillingDate(new Date())}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.paragraph}>Dear {client},</Text>
          <Text style={styles.paragraph}>
            This letter confirms that {COMPANY_INFO.name} has been engaged by{" "}
            {client} to provide the {isRecurring ? "service" : "work"} described
            below, on the terms set out in this letter.
          </Text>

          <View style={styles.list}>
            <Detail
              label="Contract no."
              value={formatContractNumber(contract.number)}
            />
            <Detail
              label="Status"
              value={`${contractStatusLabel(contract.status, contract.paymentType)} (as of ${formatBillingDate(new Date())})`}
            />
            <Detail label="Client" value={client} />
            <Detail
              label={isRecurring ? "Service" : "Project"}
              value={contract.projectName}
            />
            {contract.description && (
              <Detail label="Scope" value={contract.description} />
            )}
            <Detail
              label="Start date"
              value={formatBillingDate(contract.date)}
            />
            <Detail
              label={openEnded ? "End date" : "Deadline"}
              value={
                contract.deadline
                  ? formatBillingDate(contract.deadline)
                  : "Ongoing, until cancelled by either party"
              }
            />
            <Detail label="Fee" value={billingLine(contract)} />
            {openEnded && (
              <Detail
                label="Payment terms"
                value={`each invoice is due within ${contract.invoiceDueDays} day${contract.invoiceDueDays === 1 ? "" : "s"} of its issue date`}
              />
            )}
          </View>

          {terms.length > 0 && (
            <>
              <Text style={styles.heading}>Terms</Text>
              {terms.map((line, index) => (
                <Text key={index} style={styles.paragraph}>
                  {line}
                </Text>
              ))}
            </>
          )}

          {isRecurring && (
            <Text style={styles.paragraph}>
              Invoices are issued automatically for each billing period and sent
              to your registered email address. The service continues while your
              account is in good standing, and either party may pause or cancel
              it with written notice.
            </Text>
          )}
          <Text style={styles.paragraph}>
            Please keep this letter for your records. If anything here
            doesn&apos;t match your understanding of our arrangement, contact us
            and we&apos;ll put it right.
          </Text>

          <View style={styles.signOff} wrap={false}>
            <Text>Regards,</Text>
            <Text style={[styles.bold, { marginTop: 14 }]}>Muhammad Zayem</Text>
            <Text style={styles.small}>Owner / Software Developer</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text
            style={[
              styles.small,
              { maxWidth: 340, color: "#8d8d8d", fontStyle: "italic" },
            ]}
          >
            Computer-generated agreement — no physical signature required for
            validity. Scan to verify it and see its current status.
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

/** `origin` is the app's base URL, for the QR code's verification link. */
export async function renderAgreementPdf(
  contract: AgreementContract,
  origin: string,
) {
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(agreementVerifyUrl(contract.id, origin), {
      margin: 1,
      width: 200,
    }),
    getLogoDataUrl(),
  ]);
  return renderToBuffer(
    <AgreementDocument
      contract={contract}
      qrDataUrl={qrDataUrl}
      logoDataUrl={logoDataUrl}
    />,
  );
}
