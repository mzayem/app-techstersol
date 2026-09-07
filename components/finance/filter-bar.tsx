"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";

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
import { EXPENSE_CATEGORIES, BUCKET_LABELS } from "@/lib/finance/constants";
import type { SortOption } from "@/actions/finance/queries";

const SORT_LABELS: Record<SortOption, string> = {
  "date-desc": "Date (newest)",
  "date-asc": "Date (oldest)",
  "amount-desc": "Amount (highest)",
  "amount-asc": "Amount (lowest)",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
};

export function FilterBar({
  categoryFilter = false,
}: {
  /** Shows an expense-type filter — only meaningful on the Expenses page. */
  categoryFilter?: boolean;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const preset = searchParams.get("range") ?? "this-month";
  const sort = (searchParams.get("sort") as SortOption) ?? "date-desc";
  const category = searchParams.get("category") ?? "all";
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

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

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (searchParams.get("q") ?? "")) {
        updateParams({ q: search || null });
      }
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 transition-opacity sm:flex-row sm:flex-wrap sm:items-center",
        isPending && "opacity-60",
      )}
    >
      <div className="relative w-full sm:w-52">
        {isPending ? (
          <Loader2Icon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          placeholder="Search by name"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
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

      {categoryFilter && (
        <Select
          value={category}
          onValueChange={(value) =>
            updateParams({ category: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {BUCKET_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={sort}
        onValueChange={(value) => updateParams({ sort: value })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
