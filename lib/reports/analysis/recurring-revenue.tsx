import { View } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import type { PaymentCurrency } from "@/lib/clients/constants";
import {
  RECURRING_BILLING_STATUSES,
  RECURRING_STATUSES,
  contractAmountLabel,
  contractStatusLabel,
  type BillingCycle,
} from "@/lib/contracts/constants";
import { formatContractNumber } from "@/lib/contracts/numbering-format";
import { formatPkr } from "@/lib/finance/constants";
import { getRatesToPkr } from "@/lib/fx/rates";
import {
  ChartLegend,
  GroupedBarChart,
  HorizontalGroupedBarChart,
} from "@/lib/reports/chart";
import {
  AnalysisTable,
  Paragraph,
  Section,
  renderAnalysisPdf,
} from "@/lib/reports/analysis/layout";
import {
  resolveAnalysisRange,
  periodLabel,
} from "@/lib/reports/analysis/period";

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
});

/** Most months the trend chart shows — the most recent ones in the period. */
const MAX_CHART_MONTHS = 12;

/** Converts one billing cycle's amount to its monthly equivalent. */
const MONTHLY_FACTOR: Record<BillingCycle, number> = {
  WEEKLY: 52 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  ANNUALLY: 1 / 12,
};

const isBilling = (status: string) =>
  (RECURRING_BILLING_STATUSES as readonly string[]).includes(status);

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function inRange(date: Date | null, from?: Date, to?: Date) {
  if (!date) return false;
  return (!from || date >= from) && (!to || date <= to);
}

/** Recurring Revenue Report — monthly recurring revenue (MRR), what was
 * invoiced and collected from recurring contracts over the period, what's
 * still outstanding, and a per-contract breakdown. Every figure is in PKR:
 * collected amounts use the PKR actually received where it was recorded,
 * everything else converts at today's FX rate. */
export async function renderRecurringRevenue(
  params: Record<string, string | undefined>,
  generatedBy: string,
): Promise<Buffer> {
  const range = resolveAnalysisRange(params);
  const label = periodLabel(params, range);
  // "during 2026" reads fine; "during All time" doesn't.
  const during = label === "All time" ? "to date" : `during ${label}`;
  const During = label === "All time" ? "To date" : `During ${label}`;

  const [contracts, items, rates] = await Promise.all([
    prisma.contract.findMany({
      where: { paymentType: "RECURRING" },
      select: {
        id: true,
        number: true,
        projectName: true,
        status: true,
        currency: true,
        amount: true,
        billingCycle: true,
        date: true,
        client: { select: { name: true } },
        milestones: { select: { amount: true } },
        paymentType: true,
      },
      orderBy: { number: "asc" },
    }),
    prisma.invoiceItem.findMany({
      where: { contract: { paymentType: "RECURRING" } },
      select: {
        contractId: true,
        amount: true,
        invoice: {
          select: {
            status: true,
            issueDate: true,
            paidOn: true,
            pkrAmount: true,
            items: { select: { amount: true } },
          },
        },
      },
    }),
    getRatesToPkr(),
  ]);

  const currencyOf = new Map(
    contracts.map((c) => [c.id, c.currency as PaymentCurrency]),
  );
  const toPkr = (amount: number, currency: PaymentCurrency) =>
    currency === "PKR" ? amount : amount * (rates[currency] ?? 1);

  // Per invoice line: its PKR value when invoiced, and — once paid — its
  // share of the PKR actually received for that invoice.
  const lines = items.map((item) => {
    const currency = currencyOf.get(item.contractId!) ?? "PKR";
    const amount = Number(item.amount);
    const invoicedPkr = toPkr(amount, currency);
    const gross = item.invoice.items.reduce(
      (sum, i) => sum + Number(i.amount),
      0,
    );
    const collectedPkr =
      item.invoice.status !== "PAID"
        ? 0
        : item.invoice.pkrAmount != null && gross > 0
          ? (Number(item.invoice.pkrAmount) * amount) / gross
          : invoicedPkr;
    return {
      contractId: item.contractId!,
      invoice: item.invoice,
      invoicedPkr,
      collectedPkr,
    };
  });

  // --- Per-contract figures -------------------------------------------------
  const perContract = contracts.map((c) => {
    const cycle = c.billingCycle as BillingCycle | null;
    const mrr =
      isBilling(c.status) && cycle
        ? toPkr(Number(c.amount ?? 0), c.currency as PaymentCurrency) *
          MONTHLY_FACTOR[cycle]
        : 0;
    const own = lines.filter((l) => l.contractId === c.id);
    return {
      contract: c,
      mrr,
      invoiced: own
        .filter((l) => inRange(l.invoice.issueDate, range.from, range.to))
        .reduce((sum, l) => sum + l.invoicedPkr, 0),
      collected: own
        .filter((l) => inRange(l.invoice.paidOn, range.from, range.to))
        .reduce((sum, l) => sum + l.collectedPkr, 0),
      outstanding: own
        .filter((l) => l.invoice.status === "UNPAID")
        .reduce((sum, l) => sum + l.invoicedPkr, 0),
    };
  });

  const billingContracts = perContract.filter((p) =>
    isBilling(p.contract.status),
  );
  const mrr = billingContracts.reduce((sum, p) => sum + p.mrr, 0);
  const invoiced = perContract.reduce((sum, p) => sum + p.invoiced, 0);
  const collected = perContract.reduce((sum, p) => sum + p.collected, 0);
  const outstanding = perContract.reduce((sum, p) => sum + p.outstanding, 0);
  const collectionRate = invoiced > 0 ? (collected / invoiced) * 100 : null;
  const newInPeriod = contracts.filter((c) =>
    inRange(c.date, range.from, range.to),
  ).length;

  // --- Monthly trend ----------------------------------------------------------
  const monthTotals = new Map<
    string,
    { invoiced: number; collected: number }
  >();
  for (const l of lines) {
    if (inRange(l.invoice.issueDate, range.from, range.to)) {
      const key = monthKey(l.invoice.issueDate);
      const m = monthTotals.get(key) ?? { invoiced: 0, collected: 0 };
      m.invoiced += l.invoicedPkr;
      monthTotals.set(key, m);
    }
    if (l.invoice.paidOn && inRange(l.invoice.paidOn, range.from, range.to)) {
      const key = monthKey(l.invoice.paidOn);
      const m = monthTotals.get(key) ?? { invoiced: 0, collected: 0 };
      m.collected += l.collectedPkr;
      monthTotals.set(key, m);
    }
  }
  const months = [...monthTotals.keys()].sort().slice(-MAX_CHART_MONTHS);
  const monthLabel = (key: string) =>
    MONTH_LABEL_FORMAT.format(new Date(`${key}-01T00:00:00`));
  const trendSeries = [
    {
      label: "Invoiced",
      color: "#6366f1",
      values: months.map((m) => monthTotals.get(m)!.invoiced),
    },
    {
      label: "Collected",
      color: "#10b981",
      values: months.map((m) => monthTotals.get(m)!.collected),
    },
  ];

  // --- MRR by client --------------------------------------------------------
  const mrrByClient = new Map<string, number>();
  for (const p of billingContracts) {
    const name = p.contract.client.name;
    mrrByClient.set(name, (mrrByClient.get(name) ?? 0) + p.mrr);
  }
  const topClients = [...mrrByClient.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topShare =
    topClients.length > 0 && mrr > 0 ? (topClients[0][1] / mrr) * 100 : 0;

  // --- Tables -----------------------------------------------------------------
  const statusRows = RECURRING_STATUSES.map((status) => {
    const inStatus = perContract.filter((p) => p.contract.status === status);
    return {
      status: contractStatusLabel(status, "RECURRING"),
      count: String(inStatus.length),
      mrr: isBilling(status)
        ? formatPkr(inStatus.reduce((sum, p) => sum + p.mrr, 0))
        : "—",
    };
  }).filter((row) => row.count !== "0");

  const contractRows = perContract.map((p) => ({
    contract: `${formatContractNumber(p.contract.number)} ${p.contract.projectName}`,
    client: p.contract.client.name,
    billing: contractAmountLabel(p.contract),
    mrr: p.mrr > 0 ? formatPkr(p.mrr) : "—",
    collected: formatPkr(p.collected),
    outstanding: formatPkr(p.outstanding),
    status: contractStatusLabel(p.contract.status, "RECURRING"),
  }));

  const body = (
    <>
      <Section heading="Summary">
        <Paragraph>
          Techstersol currently has {billingContracts.length} recurring contract
          {billingContracts.length === 1 ? "" : "s"} being billed, worth{" "}
          {formatPkr(mrr)} a month in recurring revenue ({formatPkr(mrr * 12)} a
          year at the current rate).
          {newInPeriod > 0
            ? ` ${newInPeriod} recurring contract${newInPeriod === 1 ? "" : "s"} started ${during}.`
            : ""}
        </Paragraph>
        <Paragraph>
          {During}, {formatPkr(invoiced)} was invoiced on recurring contracts
          and {formatPkr(collected)} was collected
          {collectionRate !== null
            ? ` — a collection rate of ${collectionRate.toFixed(0)}%.`
            : "."}{" "}
          {outstanding > 0
            ? `${formatPkr(outstanding)} is still outstanding on unpaid recurring invoices.`
            : "Nothing is outstanding on recurring invoices."}
        </Paragraph>
        {topClients.length > 1 && (
          <Paragraph>
            {topShare > 50
              ? `Recurring revenue leans heavily on ${topClients[0][0]}, at ${topShare.toFixed(0)}% of MRR — losing that one contract would have an outsized impact.`
              : `Recurring revenue is spread across ${mrrByClient.size} clients, the largest being ${topClients[0][0]} at ${topShare.toFixed(0)}% of MRR.`}
          </Paragraph>
        )}
      </Section>

      <Section heading="Key figures">
        <AnalysisTable
          columns={[
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value", align: "right" },
          ]}
          rows={[
            {
              metric: "Monthly recurring revenue (MRR)",
              value: formatPkr(mrr),
            },
            {
              metric: "Annual run rate (MRR × 12)",
              value: formatPkr(mrr * 12),
            },
            {
              metric: "Contracts being billed",
              value: String(billingContracts.length),
            },
            { metric: `Invoiced (${label})`, value: formatPkr(invoiced) },
            { metric: `Collected (${label})`, value: formatPkr(collected) },
            {
              metric: "Collection rate",
              value:
                collectionRate !== null ? `${collectionRate.toFixed(0)}%` : "—",
            },
            { metric: "Outstanding now", value: formatPkr(outstanding) },
          ]}
        />
      </Section>

      {months.length > 0 && (
        <Section heading="Invoiced vs. collected by month">
          <GroupedBarChart
            categories={months.map(monthLabel)}
            series={trendSeries}
            valueFormatter={(v) => formatPkr(v)}
          />
          <ChartLegend series={trendSeries} />
        </Section>
      )}

      {topClients.length > 0 && (
        <Section heading="Monthly recurring revenue by client">
          <HorizontalGroupedBarChart
            categories={topClients.map(([name]) => name)}
            series={[
              {
                label: "MRR",
                color: "#6366f1",
                values: topClients.map(([, value]) => value),
              },
            ]}
            valueFormatter={(v) => formatPkr(v)}
          />
        </Section>
      )}

      {/* Short table — keep it on one page with its heading. */}
      <View wrap={false}>
        <Section heading="Contracts by status">
          <AnalysisTable
            columns={[
              { key: "status", label: "Status" },
              { key: "count", label: "Contracts", align: "right" },
              { key: "mrr", label: "MRR", align: "right" },
            ]}
            rows={statusRows}
            totalsRow={{
              status: "Total",
              count: String(contracts.length),
              mrr: formatPkr(mrr),
            }}
          />
        </Section>
      </View>

      <Section heading="Contract breakdown">
        <AnalysisTable
          columns={[
            { key: "contract", label: "Contract", flex: 2.2 },
            { key: "client", label: "Client", flex: 1.4 },
            { key: "billing", label: "Billing", align: "right", flex: 1.3 },
            { key: "mrr", label: "MRR (PKR)", align: "right" },
            { key: "collected", label: "Collected", align: "right" },
            { key: "outstanding", label: "Outstanding", align: "right" },
            { key: "status", label: "Status", align: "right" },
          ]}
          rows={contractRows}
          totalsRow={{
            contract: "Total",
            client: "",
            billing: "",
            mrr: formatPkr(mrr),
            collected: formatPkr(collected),
            outstanding: formatPkr(outstanding),
            status: "",
          }}
        />
        <View style={{ marginTop: 8 }}>
          <Paragraph>
            MRR converts each billing cycle to a monthly figure (weekly × 52/12,
            quarterly ÷ 3, annually ÷ 12) for contracts that are active,
            awaiting their advance, or have payment due. Collected is the PKR
            actually received where recorded; other amounts convert at
            today&apos;s rate.
          </Paragraph>
        </View>
      </Section>
    </>
  );

  return renderAnalysisPdf(
    "RECURRING REVENUE REPORT",
    label,
    generatedBy,
    body,
  );
}
