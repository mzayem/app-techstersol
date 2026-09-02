"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_PRESETS, DATE_PRESET_LABELS } from "@/lib/finance/date-range";
import type { SortOption } from "@/lib/finance/queries";

const SORT_LABELS: Record<SortOption, string> = {
  "date-desc": "Date (newest)",
  "date-asc": "Date (oldest)",
  "amount-desc": "Amount (highest)",
  "amount-asc": "Amount (lowest)",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
};

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const preset = searchParams.get("range") ?? "this-month";
  const sort = (searchParams.get("sort") as SortOption) ?? "date-desc";
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
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
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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

      <div className="relative w-full sm:w-52">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
