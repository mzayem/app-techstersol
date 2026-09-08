"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_DISPLAY_FORMAT, parseIsoDate, toIsoDate } from "@/lib/date/iso";

/** A single-date picker matching DateRangePicker's Popover+Calendar style —
 * replaces native <input type="date">, whose iOS rendering (a plain,
 * inconsistently sized system control that doesn't match the rest of the
 * app's styled inputs) looks out of place and can overflow its container.
 *
 * Supports both the uncontrolled name/defaultValue pattern most create/edit
 * dialogs here use (participates in a <form action={...}> submission via a
 * hidden input) and a controlled value/onValueChange pattern for fields
 * whose value drives other client-side logic (e.g. auto-deriving a due
 * date from an issue date). */
export function DatePicker({
  name,
  defaultValue,
  value,
  onValueChange,
  required,
  disabled = false,
  placeholder = "Pick a date",
  className,
}: {
  name?: string;
  /** ISO "yyyy-MM-dd" — uncontrolled initial value. */
  defaultValue?: string;
  /** ISO "yyyy-MM-dd" — controlled value; omit for uncontrolled usage. */
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internalValue;
  const date = parseIsoDate(current);

  return (
    <>
      {name && <input type="hidden" name={name} value={current} required={required} />}
      <Popover open={open && !disabled} onOpenChange={setOpen}>
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
          <span className={cn("flex-1 text-left", !date && "text-muted-foreground")}>
            {date ? DATE_DISPLAY_FORMAT.format(date) : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(next) => {
              if (!next) return;
              const iso = toIsoDate(next);
              if (!isControlled) setInternalValue(iso);
              onValueChange?.(iso);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
