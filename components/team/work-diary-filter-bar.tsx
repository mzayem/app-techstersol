"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
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
        "flex flex-col gap-2 transition-opacity sm:flex-row sm:flex-wrap sm:items-center",
        isPending && "opacity-60",
      )}
    >
      <div className="w-full sm:w-64">
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
        <SelectTrigger className="w-full sm:w-40">
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
