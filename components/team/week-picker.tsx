"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatWeekRange, mondayOf, sundayOf } from "@/lib/team/work-diary";

/** A single click on any day marks that whole Monday–Sunday week as
 * selected (via react-day-picker's range highlighting) — there's no
 * two-click range-building step like a normal date-range picker. */
export function WeekPicker({
  value,
  onChange,
  disabled = false,
  className,
}: {
  /** The Monday that starts the selected week. */
  value: Date;
  onChange: (weekStart: Date) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const weekEnd = sundayOf(value);

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">{formatWeekRange(value, weekEnd)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={{ from: value, to: weekEnd }}
          onDayClick={(day) => {
            onChange(mondayOf(day));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
