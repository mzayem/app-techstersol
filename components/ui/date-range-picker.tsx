"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_DISPLAY_FORMAT, parseIsoDate, toIsoDate } from "@/lib/date/iso";

/** A single combined "from – to" range picker — one button that opens a
 * calendar popover, replacing the old pattern of two separate
 * <input type="date"> fields side by side (which wrapped awkwardly on
 * mobile and rendered inconsistently across browsers). Same Popover +
 * Calendar(mode="range") shape as WeekPicker in the work diary, generalized
 * to an arbitrary range instead of a fixed Monday–Sunday week. */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "Pick a date range",
  className,
  disabled = false,
}: {
  /** ISO "yyyy-MM-dd" strings, or "" for unset — matching how every caller
   * already stores its from/to state (search params, dialog form state). */
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  // react-day-picker's range mode reports the *first* click as
  // { from: day, to: day } (a one-day range), not { to: undefined } — so
  // "both ends are set" isn't a reliable "the user is done" signal. Track
  // the click that started this selection so the popover only closes once
  // a genuinely second, later click has extended it into a real range.
  const draftFromRef = React.useRef<Date | undefined>(undefined);
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);

  const label = fromDate
    ? toDate
      ? `${DATE_DISPLAY_FORMAT.format(fromDate)} – ${DATE_DISPLAY_FORMAT.format(toDate)}`
      : `${DATE_DISPLAY_FORMAT.format(fromDate)} – …`
    : placeholder;

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) draftFromRef.current = undefined;
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center gap-1.5 rounded-md border border-input bg-transparent px-3 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={cn("flex-1 text-left", !fromDate && "text-muted-foreground")}>
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          defaultMonth={fromDate}
          selected={{ from: fromDate, to: toDate } as DateRange}
          onSelect={(range) => {
            onChange({
              from: range?.from ? toIsoDate(range.from) : "",
              to: range?.to ? toIsoDate(range.to) : "",
            });

            if (!range?.from) {
              draftFromRef.current = undefined;
              return;
            }
            if (!draftFromRef.current) {
              // First click of a fresh selection — remember it and keep
              // the popover open for the second (end date) click.
              draftFromRef.current = range.from;
              return;
            }
            // Second click — the range is complete.
            draftFromRef.current = undefined;
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
