"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileSignature,
  FileText,
  HandCoins,
  Handshake,
  Landmark,
  Loader2Icon,
  Receipt,
  SearchIcon,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navGroups, navMain, navSettings } from "@/components/nav/nav-data";
import type { PageKey } from "@/lib/rbac/pages";
import { globalSearch, type SearchResult } from "@/actions/search/actions";

const GROUP_ICONS: Record<string, React.ComponentType> = {
  Clients: Users,
  Contracts: FileSignature,
  Invoices: FileText,
  Team: UserCog,
  Partners: Handshake,
  Earnings: TrendingUp,
  Expenses: Receipt,
  Donations: HandCoins,
  "Bank accounts": Landmark,
};

export function CommandSearch({ visiblePages }: { visiblePages: PageKey[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // Results remember which query they answer — anything else is stale, and
  // "loading" is simply "the current query hasn't been answered yet".
  const [answered, setAnswered] = React.useState<{
    query: string;
    results: SearchResult[];
  }>({ query: "", results: [] });
  const trimmed = query.trim();
  const searchable = trimmed.length >= 2;
  const results =
    searchable && answered.query === trimmed ? answered.results : [];
  const loading = searchable && answered.query !== trimmed;

  const pages = React.useMemo(() => {
    const visible = new Set(visiblePages);
    return [
      { title: navMain.title, url: navMain.url, icon: navMain.icon, group: "" },
      ...navGroups.flatMap((g) =>
        g.items
          .filter((item) => visible.has(item.key))
          .map((item) => ({ ...item, group: g.title })),
      ),
      {
        title: navSettings.title,
        url: navSettings.url,
        icon: navSettings.icon,
        group: "",
      },
    ];
  }, [visiblePages]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!searchable) return;
    const timeout = setTimeout(async () => {
      let found: SearchResult[] = [];
      try {
        found = await globalSearch(trimmed);
      } catch {
        // Treat a failed search as "no records" rather than spinning forever.
      }
      // A slow response for an older query is simply never shown — the
      // derived `results` above only uses an answer for the current query.
      setAnswered({ query: trimmed, results: found });
    }, 250);
    return () => clearTimeout(timeout);
  }, [trimmed, searchable]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const needle = trimmed.toLowerCase();
  const matchingPages = needle
    ? pages.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          p.group.toLowerCase().includes(needle),
      )
    : pages;

  const groupedResults = results.reduce<Record<string, SearchResult[]>>(
    (acc, r) => {
      (acc[r.group] ??= []).push(r);
      return acc;
    },
    {},
  );
  const nothingFound =
    matchingPages.length === 0 && results.length === 0 && !loading;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground sm:w-64 sm:justify-start"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <SearchIcon className="size-4" />
        <span className="hidden sm:inline">Search anything…</span>
        <kbd className="pointer-events-none ml-auto hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Search"
        description="Search pages, clients, contracts, invoices and more"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search pages, clients, invoices (#00312)…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[60vh]">
            {nothingFound && (
              <CommandEmpty>No results for “{query.trim()}”.</CommandEmpty>
            )}

            {matchingPages.length > 0 && (
              <CommandGroup heading="Pages">
                {matchingPages.map((p) => (
                  <CommandItem
                    key={p.url}
                    value={`page-${p.url}`}
                    onSelect={() => go(p.url)}
                  >
                    <p.icon />
                    <span>{p.title}</span>
                    {p.group && p.group !== p.title && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {p.group}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {Object.entries(groupedResults).map(([group, items]) => {
              const Icon = GROUP_ICONS[group] ?? Building2;
              return (
                <React.Fragment key={group}>
                  <CommandSeparator />
                  <CommandGroup heading={group}>
                    {items.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={r.id}
                        onSelect={() => go(r.href)}
                      >
                        <Icon />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{r.title}</span>
                          {r.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {r.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </React.Fragment>
              );
            })}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                Searching records…
              </div>
            )}
            {!loading && needle.length === 1 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Type one more character to search records.
              </p>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
