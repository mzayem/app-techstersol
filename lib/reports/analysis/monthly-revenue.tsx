import { getMonthlySeries, computeEarningKpis } from "@/actions/overview/queries";
import { formatPkr } from "@/lib/finance/constants";
import { GroupedBarChart } from "@/lib/reports/chart";
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

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });

function monthFloor(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function renderMonthlyRevenue(
  params: Record<string, string | undefined>,
  generatedBy: string,
): Promise<Buffer> {
  const range = resolveAnalysisRange(params);
  const label = periodLabel(params, range);
  const period = toResolvedPeriod(range);

  const series = await getMonthlySeries();
  const kpis = computeEarningKpis(series, period);
  const monthly = series
    .filter((p) => {
      const date = new Date(`${p.month}T00:00:00`);
      return date >= monthFloor(period.from) && date <= period.to;
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const trendDirection =
    monthly.length >= 2 && monthly[monthly.length - 1].earning >= monthly[0].earning
      ? "an upward trend"
      : "a downward trend";

  const rows = monthly.map((p) => {
    const net = p.earning - p.teamPaid;
    return {
      month: MONTH_LABEL_FORMAT.format(new Date(`${p.month}T00:00:00`)),
      earning: formatPkr(p.earning),
      teamPaid: formatPkr(p.teamPaid),
      net: formatPkr(net),
    };
  });

  const body = (
    <>
      <Section heading="Summary">
        <Paragraph>
          Across {label}, Techstersol earned a net {formatPkr(kpis.periodEarning)} over{" "}
          {kpis.monthCount} month{kpis.monthCount === 1 ? "" : "s"}, averaging{" "}
          {formatPkr(kpis.avgMonthlyEarning)} per active month. Monthly earning over the period
          shows {trendDirection}
          {monthly.length >= 2
            ? `, moving from ${formatPkr(monthly[0].earning)} to ${formatPkr(monthly[monthly.length - 1].earning)}.`
            : "."}
        </Paragraph>
        <Paragraph>
          Standalone team payments — outsourced work or logged hours not already netted against
          a specific earning — totalled {formatPkr(kpis.totalTeamPaid)} for the period.
        </Paragraph>
      </Section>

      {monthly.length > 0 && (
        <Section heading="Earning by month">
          <GroupedBarChart
            categories={monthly.map((p) => MONTH_LABEL_FORMAT.format(new Date(`${p.month}T00:00:00`)))}
            series={[
              { label: "Earning", color: "#10b981", values: monthly.map((p) => p.earning) },
            ]}
            valueFormatter={(v) => formatPkr(v)}
          />
        </Section>
      )}

      <Section heading="Monthly breakdown">
        <AnalysisTable
          columns={[
            { key: "month", label: "Month" },
            { key: "earning", label: "Earning", align: "right" },
            { key: "teamPaid", label: "Team pay", align: "right" },
            { key: "net", label: "Net", align: "right" },
          ]}
          rows={rows}
          totalsRow={{
            month: "Total",
            earning: formatPkr(kpis.periodEarning + kpis.totalTeamPaid),
            teamPaid: formatPkr(kpis.totalTeamPaid),
            net: formatPkr(kpis.periodEarning),
          }}
        />
      </Section>
    </>
  );

  return renderAnalysisPdf("MONTHLY REVENUE REPORT", label, generatedBy, body);
}
