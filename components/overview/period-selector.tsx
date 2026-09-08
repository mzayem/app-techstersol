"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OVERVIEW_PERIODS, OVERVIEW_PERIOD_LABELS } from "@/lib/overview/period";

export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const period = searchParams.get("period") ?? "this-year";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center gap-2 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <Select
        value={period}
        onValueChange={(value) =>
          updateParams({
            period: value,
            ...(value !== "custom" ? { from: null, to: null } : {}),
          })
        }
      >
        <SelectTrigger className="min-w-32 flex-1 sm:w-40 sm:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OVERVIEW_PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {OVERVIEW_PERIOD_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {period === "custom" && (
        <DateRangePicker
          className="basis-full sm:w-64 sm:basis-auto"
          from={searchParams.get("from") ?? ""}
          to={searchParams.get("to") ?? ""}
          onChange={({ from, to }) => updateParams({ from: from || null, to: to || null })}
        />
      )}

      {isPending && (
        <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
