import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { activityEntityLabel } from "@/lib/activity/constants";
import { parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { getVisiblePages, requirePagePermission } from "@/lib/rbac/permissions";
import { listActivity } from "@/actions/activity/queries";

export const dynamic = "force-dynamic";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { appUser } = await requirePagePermission("activity-log");
  const params = await searchParams;

  const activity = await listActivity(
    {
      search: params.q,
      entityType: params.type,
      page: parsePageParam(params.page),
      pageSize: parsePageSizeParam(params.pageSize),
    },
    getVisiblePages(appUser),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          Who created, changed, or deleted what — newest first. Entries for
          pages your role can&apos;t open are hidden.
        </p>
      </div>

      <ActivityFilterBar />

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead className="w-48">Who</TableHead>
              <TableHead className="w-36">Record</TableHead>
              <TableHead>What happened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.totalItems === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No activity recorded yet.
                </TableCell>
              </TableRow>
            )}
            {activity.items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDateTime(entry.createdAt)}
                </TableCell>
                <TableCell>
                  <span className="block font-medium">{entry.actorName}</span>
                  {entry.actorEmail && (
                    <span className="block text-xs text-muted-foreground">
                      {entry.actorEmail}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {activityEntityLabel(entry.entityType)}
                  </span>
                </TableCell>
                <TableCell className="whitespace-normal">
                  {entry.summary}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={activity.page}
          totalPages={activity.totalPages}
          totalItems={activity.totalItems}
          pageSize={activity.pageSize}
        />
      </div>
    </div>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  }).format(date);
}
