"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_PRESETS, DATE_PRESET_LABELS } from "@/lib/finance/date-range";

export function DistributionFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const preset = searchParams.get("range") ?? "this-year";

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
        "flex flex-wrap items-center gap-2 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <Select
        value={preset}
        onValueChange={(value) =>
          updateParams({
            range: value,
            ...(value !== "custom" ? { from: null, to: null } : {}),
          })
        }
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {DATE_PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-36"
            defaultValue={searchParams.get("from") ?? ""}
            onChange={(e) => updateParams({ from: e.target.value || null })}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            className="w-36"
            defaultValue={searchParams.get("to") ?? ""}
            onChange={(e) => updateParams({ to: e.target.value || null })}
          />
        </div>
      )}

      {isPending && (
        <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
