import { StatCards } from "@/components/finance/stat-cards";
import {
  BUCKETS,
  BUCKET_ICONS,
  BUCKET_LABELS,
  DISTRIBUTION_SPLIT,
  formatPkr,
} from "@/lib/finance/constants";
import {
  getDistributionBreakdown,
  getTotalNetEarnings,
} from "@/actions/finance/queries";

export const dynamic = "force-dynamic";

export default async function DistributionsPage() {
  const [breakdown, netEarnings] = await Promise.all([
    getDistributionBreakdown(),
    getTotalNetEarnings(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Distributions</h1>
        <p className="text-sm text-muted-foreground">
          Every earning is split automatically — nothing to add here.
        </p>
      </div>

      <StatCards
        balances={
          Object.fromEntries(
            BUCKETS.map((b) => [b, breakdown[b].remaining]),
          ) as Record<(typeof BUCKETS)[number], number>
        }
      />

      <div className="rounded-md bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Total net earning distributed:{" "}
          <span className="font-medium text-foreground">
            {formatPkr(netEarnings)}
          </span>
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
