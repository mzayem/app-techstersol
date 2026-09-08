"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentYearMonthOptions } from "@/lib/team/work-diary";

const MONTH_OPTIONS = currentYearMonthOptions();

export function WorkDiaryFilterBar({
  teamMembers,
}: {
  teamMembers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const teamMemberId = searchParams.get("teamMemberId") ?? "";
  const period = searchParams.get("period") ?? "year";

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
      <div className="w-full basis-full sm:w-64 sm:basis-auto">
        <Combobox
          value={teamMemberId}
          onValueChange={(v) => updateParams({ teamMemberId: v || null })}
          options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
          placeholder="All team members"
          searchPlaceholder="Search team…"
          emptyText="No team members found."
        />
      </div>

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
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="year">This year</SelectItem>
          {MONTH_OPTIONS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom range</SelectItem>
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
