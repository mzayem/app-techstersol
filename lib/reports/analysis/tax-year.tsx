import { getMonthlySeries, computeEarningKpis, getDistributionAudit } from "@/actions/overview/queries";
import { formatPkr } from "@/lib/finance/constants";
import { fiscalYearRange, formatFiscalYearLabel } from "@/lib/finance/date-range";
import { GroupedBarChart } from "@/lib/reports/chart";
import {
  AnalysisTable,
  Paragraph,
  Section,
  SignatureBlock,
  renderAnalysisPdf,
} from "@/lib/reports/analysis/layout";
import type { ResolvedPeriod } from "@/lib/overview/period";

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "short" });
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function monthFloor(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The most recent fiscal year (July–June) that has already started, as a
 * fallback when the caller does not specify one. */
function currentFiscalYearStart(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

export async function renderTaxYearReport(
  params: Record<string, string | undefined>,
  generatedBy: string,
): Promise<Buffer> {
  const startYear = params.fiscalYear ? Number(params.fiscalYear) : currentFiscalYearStart();
  const range = fiscalYearRange(startYear);
  const period: ResolvedPeriod = { from: range.from!, to: range.to! };
  const label = `Fiscal Year ${formatFiscalYearLabel(startYear)} (1 July ${startYear} – 30 June ${startYear + 1})`;

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
  const netMargin =
    kpis.periodEarning + kpis.totalTeamPaid > 0
      ? (kpis.periodEarning / (kpis.periodEarning + kpis.totalTeamPaid)) * 100
      : 0;

  const distributionRows = [
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
          ? `${Math.round(a.overFraction * 100)}% over allocation`
          : `${Math.round(Math.abs(a.overFraction) * 100)}% under allocation`,
  }));

  const signOffDate = DATE_FORMAT.format(new Date());

  const body = (
    <>
      <Section heading="Overview">
        <Paragraph>
          This report presents a summary of Techstersol’s financial activity for the fiscal
          year running from 1 July {startYear} to 30 June {startYear + 1}. During this period,
          the company recorded net earning of {formatPkr(kpis.periodEarning)}, averaging{" "}
          {formatPkr(kpis.avgMonthlyEarning)} per active month across {kpis.monthCount} month
          {kpis.monthCount === 1 ? "" : "s"} of recorded activity.
        </Paragraph>
        <Paragraph>
          A total of {formatPkr(totalExpenseLike)} was allocated toward expenses, investment,
          and charitable donations combined over the year, following the company’s standard
          distribution split of net earning. Team payments — compensation for outsourced work
          and logged hours not already netted against a specific booked earning — amounted to{" "}
          {formatPkr(kpis.totalTeamPaid)}, representing {(100 - netMargin).toFixed(1)}% of gross
          earning for the year.
        </Paragraph>
        <Paragraph>
          {audit.expenses.overFraction !== null && audit.expenses.overFraction > 0
            ? "Expense spending exceeded its allocated share for the year, which management should factor into planning for the year ahead."
            : "Expense spending stayed within its allocated share for the year, reflecting disciplined budget management."}
        </Paragraph>
      </Section>

      {monthly.length > 0 && (
        <Section heading="Monthly earning and expenses">
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

      <Section heading="Distribution summary">
        <AnalysisTable
          columns={[
            { key: "bucket", label: "Bucket" },
            { key: "allocated", label: "Allocated", align: "right" },
            { key: "spent", label: "Spent", align: "right" },
            { key: "status", label: "Status", align: "right" },
          ]}
          rows={distributionRows}
        />
      </Section>

      <Section heading="Certification">
        <Paragraph>
          This report has been prepared from Techstersol’s recorded financial data for the
          fiscal year stated above and is certified accurate to the best of management’s
          knowledge as of the date signed below.
        </Paragraph>
        <Paragraph>Date: {signOffDate}</Paragraph>
      </Section>

      <SignatureBlock />
    </>
  );

  return renderAnalysisPdf(
    "ANNUAL REPORT",
    label,
    generatedBy,
    body,
  );
}
