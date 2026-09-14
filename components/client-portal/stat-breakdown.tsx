"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StatBreakdownEntry = { label: string; value: string };

/** A single overview/contracts stat tile. When `breakdown` has 2+ entries
 * (a login with multiple client profiles), the value becomes interactive:
 * hovering reveals the per-profile split on desktop, and tapping toggles
 * it on mobile, where there's no hover to rely on. With 0-1 entries it's
 * just a plain tile — nothing to drill into for a single-profile login. */
export function StatTile({
  label,
  value,
  breakdown,
}: {
  label: string;
  value: string;
  breakdown?: StatBreakdownEntry[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-card p-4 ring-1 ring-foreground/10">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {breakdown && breakdown.length > 1 ? (
        <StatValueWithBreakdown value={value} breakdown={breakdown} />
      ) : (
        <span className="text-lg font-medium tabular-nums">{value}</span>
      )}
    </div>
  );
}

function StatValueWithBreakdown({
  value,
  breakdown,
}: {
  value: string;
  breakdown: StatBreakdownEntry[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="w-fit text-lg font-medium tabular-nums underline decoration-dotted decoration-muted-foreground/50 underline-offset-4"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={() => setOpen((o) => !o)}
          />
        }
      >
        {value}
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          {breakdown.map((entry) => (
            <div
              key={entry.label}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-muted-foreground">{entry.label}</span>
              <span className="tabular-nums">{entry.value}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
