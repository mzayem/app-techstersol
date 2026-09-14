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

export function ClientContractsFilterBar({
  profiles,
}: {
  profiles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const profile = searchParams.get("profile") ?? "all";
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
      <div className="relative w-full sm:w-64">
        {isPending ? (
          <Loader2Icon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          placeholder="Search projects"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {profiles.length > 1 && (
        <Select
          value={profile}
          onValueChange={(value) =>
            updateParams({ profile: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All profiles</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
