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
import { ACTIVITY_ENTITY_LABELS } from "@/lib/activity/constants";

const TYPE_ITEMS = [
  { value: "all", label: "All record types" },
  ...Object.entries(ACTIVITY_ENTITY_LABELS)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

export function ActivityFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const type = searchParams.get("type") ?? "all";
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    // A new filter means a new result set — start again from page 1.
    params.delete("page");
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
      <Select
        items={TYPE_ITEMS}
        value={type}
        onValueChange={(value) =>
          updateParams({ type: value === "all" ? null : value })
        }
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative w-full sm:w-64">
        {isPending ? (
          <Loader2Icon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          placeholder="Search by user or details"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
    </div>
  );
}
