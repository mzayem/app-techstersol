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
import {
  PROJECT_STATUSES,
  RECURRING_STATUSES,
  contractStatusLabel,
} from "@/lib/contracts/constants";
import type { SortOption } from "@/actions/contracts/queries";

/** Not a real sort param — the grouped view (open contracts by deadline,
 * then completed/cancelled by last modified) used when `sort` is absent. */
const DEFAULT_SORT = "default";

type SortChoice = typeof DEFAULT_SORT | SortOption;

const SORT_LABELS: Partial<Record<SortChoice, string>> = {
  [DEFAULT_SORT]: "Default (open first)",
  "deadline-asc": "Deadline: nearest first",
  "deadline-desc": "Deadline: furthest first",
  "updated-desc": "Recently updated",
  "date-desc": "Start date: newest first",
  "date-asc": "Start date: oldest first",
  "name-asc": "Project name: A → Z",
  "name-desc": "Project name: Z → A",
};

/** On the recurring page the default view orders open contracts by their
 * next invoice date instead of a deadline. */
const RECURRING_SORT_LABELS: Partial<Record<SortChoice, string>> = {
  [DEFAULT_SORT]: "Default (open first)",
  "next-invoice-asc": "Next invoice: soonest first",
  "deadline-asc": "End date: soonest first",
  "updated-desc": "Recently updated",
  "date-desc": "Start date: newest first",
  "date-asc": "Start date: oldest first",
  "name-asc": "Service name: A → Z",
  "name-desc": "Service name: Z → A",
};

export function ContractFilterBar({
  variant = "project",
}: {
  variant?: "project" | "recurring";
}) {
  const isRecurringPage = variant === "recurring";
  const sortLabels = isRecurringPage ? RECURRING_SORT_LABELS : SORT_LABELS;
  const statuses = isRecurringPage ? RECURRING_STATUSES : PROJECT_STATUSES;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const status = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;
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
      <Select
        value={status}
        onValueChange={(value) =>
          updateParams({ status: value === "all" ? null : value })
        }
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s} value={s}>
              {contractStatusLabel(
                s,
                isRecurringPage ? "RECURRING" : "PROJECT",
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative w-full sm:w-56">
        {isPending ? (
          <Loader2Icon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          placeholder="Search by project or client"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Select
        value={sort}
        onValueChange={(value) =>
          updateParams({ sort: value === DEFAULT_SORT ? null : value })
        }
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(sortLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
