"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WorkDiaryFilterBar({
  teamMembers,
  monthOptions,
}: {
  teamMembers: { id: string; name: string }[];
  monthOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teamMemberId = searchParams.get("teamMemberId") ?? "";
  const month = searchParams.get("month") ?? "";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="w-full sm:w-64">
        <Combobox
          value={teamMemberId}
          onValueChange={(v) => updateParams({ teamMemberId: v || null })}
          options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
          placeholder="All team members"
          searchPlaceholder="Search team…"
          emptyText="No team members found."
        />
      </div>
      <Select
        value={month || "all"}
        onValueChange={(v) => updateParams({ month: v === "all" ? null : v })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          {monthOptions.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
