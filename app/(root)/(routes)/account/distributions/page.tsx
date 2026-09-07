import { StatCards } from "@/components/finance/stat-cards";
import { DistributionFilterBar } from "@/components/finance/distribution-filter-bar";
import {
  BUCKETS,
  BUCKET_ICONS,
  BUCKET_LABELS,
  DISTRIBUTION_SPLIT,
  formatPkr,
} from "@/lib/finance/constants";
import { resolveDateRange } from "@/lib/finance/date-range";
import {
  getBucketBalances,
  getDistributionBreakdown,
  getTotalNetEarnings,
} from "@/actions/finance/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function DistributionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission("distributions");
  const params = await searchParams;
  const dateRange = resolveDateRange(params.range ?? "this-year", params.from, params.to);

  // The stat cards are running balances that carry credit/debit across
  // years, so they always show the all-time figure regardless of the time
  // filter below — only the per-bucket "spent vs allocated for this period"
  // audit and the earning/team-pay/net summary are scoped to it.
  const [allTimeBalances, breakdown, { totalEarning, totalTeamPay, netEarning }] =
    await Promise.all([
      getBucketBalances(),
      getDistributionBreakdown(dateRange),
      getTotalNetEarnings(dateRange),
    ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Distributions</h1>
        <p className="text-sm text-muted-foreground">
          Every earning is split automatically — nothing to add here.
        </p>
      </div>

      <DistributionFilterBar />

      <StatCards balances={allTimeBalances} />

      <div className="rounded-md bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Earning is <span className="font-medium text-foreground">{formatPkr(totalEarning)}</span>
          {", team pay is "}
          <span className="font-medium text-foreground">{formatPkr(totalTeamPay)}</span>
          {", net is "}
          <span className="font-medium text-foreground">{formatPkr(netEarning)}</span>
        </p>

        <div className="mt-6 flex flex-col gap-5">
          {BUCKETS.map((bucket) => {
            const Icon = BUCKET_ICONS[bucket];
            const { allocated, spent, remaining } = breakdown[bucket];
            const usedPct =
              allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
            return (
              <div key={bucket} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {BUCKET_LABELS[bucket]}
                    <span className="text-muted-foreground">
                      ({Math.round(DISTRIBUTION_SPLIT[bucket] * 100)}%)
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatPkr(spent)} of {formatPkr(allocated)} used
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      "h-full rounded-full " +
                      (remaining < 0 ? "bg-destructive" : "bg-primary")
                    }
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <span
                  className={
                    "text-xs " +
                    (remaining < 0
                      ? "text-destructive"
                      : "text-muted-foreground")
                  }
                >
                  {remaining < 0 ? "Over by " : "Remaining: "}
                  {formatPkr(Math.abs(remaining))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
