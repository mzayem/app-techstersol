"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ComboboxOption = { value: string; label: string };

/** How many options show before the user types a search query. Typing
 * filters across every loaded option, not just this default page. */
const DEFAULT_VISIBLE_COUNT = 20;

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  className,
}: {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options.slice(0, DEFAULT_VISIBLE_COUNT);
    return options.filter((o) => o.label.toLowerCase().includes(query));
  }, [options, search]);

  const selected = options.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
              className,
            )}
          />
        }
      >
        <span
          className={cn(
            "line-clamp-1 flex-1 text-left",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-36 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__none__"
                data-checked={value === ""}
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <span className="text-muted-foreground">{placeholder}</span>
              </CommandItem>
            </CommandGroup>
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    data-checked={option.value === value}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {filtered.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
