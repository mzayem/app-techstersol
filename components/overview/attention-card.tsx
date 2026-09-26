import Link from "next/link";
import {
  AlarmClockIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  FilePlus2Icon,
  FileWarningIcon,
  HandCoinsIcon,
  InboxIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttentionGroup } from "@/actions/overview/attention";

const GROUP_ICONS: Record<
  AttentionGroup["key"],
  React.ComponentType<{ className?: string }>
> = {
  "overdue-invoices": FileWarningIcon,
  "due-soon-invoices": AlarmClockIcon,
  deadlines: CalendarClockIcon,
  proposals: InboxIcon,
  "ready-to-invoice": FilePlus2Icon,
  "partner-payouts": HandCoinsIcon,
};

export function AttentionCard({ groups }: { groups: AttentionGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-1">
          <CircleCheckIcon className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium">All clear</p>
            <p className="text-sm text-muted-foreground">
              No overdue invoices, upcoming deadlines, or pending reviews right
              now.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>
          What&apos;s overdue or coming up — across all time, not just the
          selected period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const Icon = GROUP_ICONS[group.key];
            const urgent = group.rows.some((r) => r.urgent);
            return (
              <div
                key={group.key}
                className="flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      urgent
                        ? "text-red-600 dark:text-red-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {group.title}
                  </span>
                  <span
                    className={cn(
                      "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
                      urgent
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {group.count}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {group.rows.map((row) => (
                    <li key={row.id} className="min-w-0 text-sm">
                      <span className="block truncate">{row.label}</span>
                      <span
                        className={cn(
                          "block truncate text-xs",
                          row.urgent
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {row.detail}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={group.href}
                  className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
                >
                  {group.count > group.rows.length
                    ? `View all ${group.count}`
                    : "Open"}
                  <ArrowRightIcon className="size-3" />
                </Link>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
