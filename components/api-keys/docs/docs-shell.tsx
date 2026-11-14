"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { cn } from "cn";

import { MethodBadge, type Method } from "./method-badge";

export type DocsPage = {
  id: string;
  group: string;
  title: string;
  badge?: Method;
  content: ReactNode;
};

const DEFAULT_ID = "introduction";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const getHash = () => window.location.hash.slice(1);
const getServerHash = () => "";

export function DocsShell({ pages }: { pages: DocsPage[] }) {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const index = Math.max(
    0,
    pages.findIndex((p) => p.id === (hash || DEFAULT_ID)),
  );
  const page = pages[index];
  const prev = pages[index - 1];
  const next = pages[index + 1];

  const groups: { name: string; items: DocsPage[] }[] = [];
  for (const p of pages) {
    const g = groups.find((x) => x.name === p.group);
    if (g) g.items.push(p);
    else groups.push({ name: p.group, items: [p] });
  }

  function go(id: string) {
    window.history.pushState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="API documentation" className="min-w-0">
        {/* Small screens: horizontally scrollable pill row */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
          {pages.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(p.id);
              }}
              aria-current={p.id === page.id ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors",
                p.id === page.id
                  ? "border-primary/30 bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p.title}
            </a>
          ))}
        </div>

        {/* lg+: sticky grouped sidebar */}
        <div className="sticky top-6 hidden flex-col gap-5 lg:flex lg:top-24">
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col gap-1">
              <span className="px-3 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                {g.name}
              </span>
              {g.items.map((p) => {
                const active = p.id === page.id;
                return (
                  <a
                    key={p.id}
                    href={`#${p.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(p.id);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border-l-2 px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {p.title}
                    {p.badge ? <MethodBadge method={p.badge} /> : null}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0">
        <div
          key={page.id}
          className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in"
        >
          {page.content}
        </div>

        <div className="mt-10 grid gap-3 border-t pt-6 sm:grid-cols-2">
          {prev ? (
            <a
              href={`#${prev.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(prev.id);
              }}
              className="group flex flex-col gap-0.5 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowLeftIcon className="size-3" />
                Previous
              </span>
              <span className="text-sm font-medium">{prev.title}</span>
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a
              href={`#${next.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(next.id);
              }}
              className="group flex flex-col items-end gap-0.5 rounded-lg border p-3 text-right transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Next
                <ArrowRightIcon className="size-3" />
              </span>
              <span className="text-sm font-medium">{next.title}</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
