import { getMonthlySeries, computeEarningKpis, getDistributionAudit } from "@/actions/overview/queries";
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

export async function renderPerformance(
  params: Record<string, string | undefined>,
  generatedBy: string,
): Promise<Buffer> {
  const range = resolveAnalysisRange(params);
  const label = periodLabel(params, range);
  const period = toResolvedPeriod(range);

  const series = await getMonthlySeries();
  const kpis = computeEarningKpis(series, period);
  const audit = getDistributionAudit(series, period);
  const monthly = series
    .filter((p) => {
      const date = new Date(`${p.month}T00:00:00`);
      return date >= monthFloor(period.from) && date <= period.to;
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const totalExpenseLike = kpis.totalExpenses + kpis.totalInvestment + kpis.totalDonations;
  const teamPayRatio = kpis.periodEarning + kpis.totalTeamPaid > 0
    ? (kpis.totalTeamPaid / (kpis.periodEarning + kpis.totalTeamPaid)) * 100
    : 0;

  const auditRows = [
    { name: "Expenses", audit: audit.expenses },
    { name: "Investment", audit: audit.investment },
    { name: "Donation", audit: audit.donation },
  ].map(({ name, audit: a }) => ({
    bucket: name,
    allocated: formatPkr(a.allocated),
    spent: formatPkr(a.spent),
    status:
      a.overFraction === null
        ? "—"
        : a.overFraction > 0
          ? `${Math.round(a.overFraction * 100)}% over`
          : `${Math.round(Math.abs(a.overFraction) * 100)}% under`,
  }));

  const body = (
    <>
      <Section heading="Summary">
        <Paragraph>
          Over {label}, Techstersol recorded {formatPkr(kpis.periodEarning)} in net earning
          against {formatPkr(totalExpenseLike)} allocated toward expenses, investment, and
          donations combined. Team payments — outsourced work and logged hours paid outside a
          booked earning — made up {teamPayRatio.toFixed(1)}% of gross earning for the period.
        </Paragraph>
        <Paragraph>
          {audit.expenses.overFraction !== null && audit.expenses.overFraction > 0
            ? "Expense spending ran ahead of its allocated share this period, which is worth a closer look if it continues."
            : "Expense spending stayed within its allocated share this period."}
        </Paragraph>
      </Section>

      {monthly.length > 0 && (
        <Section heading="Earning vs. expense trend">
          <GroupedBarChart
            categories={monthly.map((p) => MONTH_LABEL_FORMAT.format(new Date(`${p.month}T00:00:00`)))}
            series={[
              { label: "Earning", color: "#10b981", values: monthly.map((p) => p.earning) },
              {
                label: "Expenses",
                color: "#f43f5e",
                values: monthly.map((p) => p.expense + p.lifestyle + p.emergencyFund),
              },
            ]}
            valueFormatter={(v) => formatPkr(v)}
          />
        </Section>
      )}

      <Section heading="Distribution audit">
        <AnalysisTable
          columns={[
            { key: "bucket", label: "Bucket" },
            { key: "allocated", label: "Allocated", align: "right" },
            { key: "spent", label: "Spent", align: "right" },
            { key: "status", label: "Status", align: "right" },
          ]}
          rows={auditRows}
        />
      </Section>
    </>
  );

  return renderAnalysisPdf("PERFORMANCE REPORT", label, generatedBy, body);
}
