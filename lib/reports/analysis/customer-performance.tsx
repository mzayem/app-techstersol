import { getClientRevenueBreakdown } from "@/actions/overview/queries";
import { formatPkr } from "@/lib/finance/constants";
import { HorizontalGroupedBarChart } from "@/lib/reports/chart";
import {
  AnalysisTable,
  Paragraph,
  Section,
  renderAnalysisPdf,
} from "@/lib/reports/analysis/layout";
import {
  resolveAnalysisRange,
  periodLabel,
  toResolvedPeriod,
} from "@/lib/reports/analysis/period";

const TOP_N = 8;

export async function renderCustomerPerformance(
  params: Record<string, string | undefined>,
  generatedBy: string,
): Promise<Buffer> {
  const range = resolveAnalysisRange(params);
  const label = periodLabel(params, range);
  const period = toResolvedPeriod(range);

  const slices = await getClientRevenueBreakdown(period);
  const totalRevenue = slices.reduce((sum, s) => sum + s.revenue, 0);
  const sorted = [...slices].sort((a, b) => b.revenue - a.revenue);
  const top = sorted.slice(0, TOP_N);
  const topClient = sorted.find((s) => !s.isOther);
  const topShare = topClient && totalRevenue > 0 ? (topClient.revenue / totalRevenue) * 100 : 0;

  const rows = sorted.map((s) => ({
    client: s.isOther ? "Other (no linked client)" : s.clientName,
    projects: s.isOther ? "" : String(s.projectCount),
    revenue: formatPkr(s.revenue),
    share: totalRevenue > 0 ? `${((s.revenue / totalRevenue) * 100).toFixed(1)}%` : "0%",
  }));

  const body = (
    <>
      <Section heading="Summary">
        <Paragraph>
          During {label}, Techstersol recorded {formatPkr(totalRevenue)} in revenue attributed
          to invoiced client work across {slices.filter((s) => !s.isOther).length} client
          {slices.filter((s) => !s.isOther).length === 1 ? "" : "s"}.{" "}
          {topClient
            ? `The top client, ${topClient.clientName}, accounted for ${formatPkr(topClient.revenue)} — ${topShare.toFixed(1)}% of revenue for the period.`
            : "No client-attributed revenue was recorded for this period."}
        </Paragraph>
        <Paragraph>
          {topShare > 40
            ? "Revenue is concentrated in a small number of relationships — worth watching, since losing any one of the top clients would have an outsized impact."
            : "Revenue is reasonably spread across the client base, reducing dependence on any single relationship."}
        </Paragraph>
      </Section>

      {top.length > 0 && (
        <Section heading="Top clients by revenue">
          <HorizontalGroupedBarChart
            categories={top.map((s) => (s.isOther ? "Other" : s.clientName))}
            series={[{ label: "Revenue", color: "#0ea5e9", values: top.map((s) => s.revenue) }]}
            width={480}
            valueFormatter={(v) => formatPkr(v)}
          />
        </Section>
      )}

      <Section heading="All clients">
        <AnalysisTable
          columns={[
            { key: "client", label: "Client" },
            { key: "projects", label: "Projects", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={rows}
          totalsRow={{
            client: "Total",
            projects: "",
            revenue: formatPkr(totalRevenue),
            share: "100%",
          }}
        />
      </Section>
    </>
  );

  return renderAnalysisPdf("CUSTOMER PERFORMANCE REPORT", label, generatedBy, body);
}
