import { BUCKETS, BUCKET_ICONS, BUCKET_LABELS, formatPkr, type Bucket } from "@/lib/finance/constants";

export function StatCards({ balances }: { balances: Record<Bucket, number> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {BUCKETS.map((bucket) => {
        const Icon = BUCKET_ICONS[bucket];
        const value = balances[bucket];
        return (
          <div
            key={bucket}
            className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="size-4" />
              <span className="text-xs font-medium">{BUCKET_LABELS[bucket]}</span>
            </div>
            <span
              className={
                "text-lg font-medium tabular-nums " +
                (value < 0 ? "text-destructive" : "text-foreground")
              }
            >
              {formatPkr(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
