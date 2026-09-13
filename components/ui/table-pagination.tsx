"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

/** Prev/next/reset + a rows-per-page picker for a page-sliced table (see
 * lib/pagination.ts). Reads and writes the `page`/`pageSize` search params
 * directly, so it composes with whatever filter bar already owns the rest
 * of the query string. */
export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function goToPage(target: number) {
    updateParams({ page: target <= 1 ? null : String(target) });
  }

  function changePageSize(size: string | null) {
    if (!size) return;
    // Rows-per-page changes shift which page a given row falls on, so land
    // back on page 1 rather than keeping a now-meaningless page number.
    updateParams({
      pageSize: Number(size) === 15 ? null : size,
      page: null,
    });
  }

  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2.5 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Showing {from}–{to} of {totalItems}</span>
        <Select value={String(pageSize)} onValueChange={changePageSize}>
          <SelectTrigger size="sm" className="h-7 w-auto gap-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Reset to first page"
          disabled={atFirst || isPending}
          onClick={() => goToPage(1)}
        >
          <RotateCcwIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={atFirst || isPending}
          onClick={() => goToPage(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="min-w-14 px-1 text-center tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={atLast || isPending}
          onClick={() => goToPage(page + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
