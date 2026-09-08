import { getDistributionBreakdown } from "@/actions/finance/queries";
import { BUCKET_LABELS, BUCKETS, DISTRIBUTION_SPLIT, formatPkr } from "@/lib/finance/constants";
import { HorizontalGroupedBarChart } from "@/lib/reports/chart";
import {
  AnalysisTable,
  Paragraph,
  Section,
  renderAnalysisPdf,
} from "@/lib/reports/analysis/layout";
import { resolveAnalysisRange, periodLabel } from "@/lib/reports/analysis/period";

export async function renderExpenseTracking(
  params: Record<string, string | undefined>,
  generatedBy: string,
): Promise<Buffer> {
  const range = resolveAnalysisRange(params);
  const label = periodLabel(params, range);

  const breakdown = await getDistributionBreakdown(range);

  const totalAllocated = BUCKETS.reduce((sum, b) => sum + breakdown[b].allocated, 0);
  const totalSpent = BUCKETS.reduce((sum, b) => sum + breakdown[b].spent, 0);
  const overBuckets = BUCKETS.filter((b) => breakdown[b].remaining < 0);

  const rows = BUCKETS.map((bucket) => {
    const { allocated, spent, remaining } = breakdown[bucket];
    return {
      bucket: `${BUCKET_LABELS[bucket]} (${Math.round(DISTRIBUTION_SPLIT[bucket] * 100)}%)`,
      allocated: formatPkr(allocated),
      spent: formatPkr(spent),
      remaining: formatPkr(remaining),
    };
  });

  const body = (
    <>
      <Section heading="Summary">
        <Paragraph>
          Against a total allocation of {formatPkr(totalAllocated)} across its five distribution
          buckets for {label}, Techstersol spent {formatPkr(totalSpent)} —{" "}
          {totalAllocated > 0
            ? `${((totalSpent / totalAllocated) * 100).toFixed(1)}% of the allocation`
            : "no allocation was available to compare against"}
          .{" "}
          {overBuckets.length > 0
            ? `${overBuckets.length} bucket${overBuckets.length === 1 ? "" : "s"} — ${overBuckets.map((b) => BUCKET_LABELS[b]).join(", ")} — ran over its allocated share.`
            : "Every bucket stayed within its allocated share for the period."}
        </Paragraph>
      </Section>

      <Section heading="Allocated vs. spent by bucket">
        <HorizontalGroupedBarChart
          categories={BUCKETS.map((b) => BUCKET_LABELS[b])}
          series={[
            {
              label: "Allocated",
              color: "#9ca3af",
              values: BUCKETS.map((b) => breakdown[b].allocated),
            },
            {
              label: "Spent",
              color: "#f43f5e",
              values: BUCKETS.map((b) => breakdown[b].spent),
            },
          ]}
          width={480}
          rowHeight={18}
          valueFormatter={(v) => formatPkr(v)}
        />
      </Section>

      <Section heading="Bucket detail">
        <AnalysisTable
          columns={[
            { key: "bucket", label: "Bucket" },
            { key: "allocated", label: "Allocated", align: "right" },
            { key: "spent", label: "Spent", align: "right" },
            { key: "remaining", label: "Remaining", align: "right" },
          ]}
          rows={rows}
          totalsRow={{
            bucket: "Total",
            allocated: formatPkr(totalAllocated),
            spent: formatPkr(totalSpent),
            remaining: formatPkr(totalAllocated - totalSpent),
          }}
        />
      </Section>
    </>
  );

  return renderAnalysisPdf("EXPENSE TRACKING REPORT", label, generatedBy, body);
}
