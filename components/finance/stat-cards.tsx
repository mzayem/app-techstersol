import { cn } from "@/lib/utils";
import {
  BUCKETS,
  BUCKET_ICONS,
  BUCKET_LABELS,
  formatPkr,
  type Bucket,
} from "@/lib/finance/constants";

export function StatCards({ balances }: { balances: Record<Bucket, number> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {BUCKETS.map((bucket, index) => {
        const Icon = BUCKET_ICONS[bucket];
        const value = balances[bucket];
        const isLast = index === BUCKETS.length - 1;
        return (
          <div
            key={bucket}
            className={cn(
              "flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10",
              // On the 2-column mobile grid the odd 5th card would be left
              // alone with an empty gap beside it — span it full width
              // instead. Once sm/lg switch to 3 or 5 columns it fits the
              // row normally, so the span is reset back to 1 there.
              isLast && "col-span-2 sm:col-span-1",
            )}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="size-4" />
              <span className="text-xs font-medium">
                {BUCKET_LABELS[bucket]}
              </span>
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
