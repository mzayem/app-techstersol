import Link from "next/link";
import { BookOpenIcon } from "lucide-react";

import {
  ApiKeyDialog,
  ApiKeyRowActions,
} from "@/components/api-keys/api-key-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { BUSINESS_TIME_ZONE } from "@/lib/date/iso";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/rbac/permissions";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: BUSINESS_TIME_ZONE,
});

export async function ApiKeysView({
  searchParams: params,
  docsHref,
}: {
  searchParams: Record<string, string | undefined>;
  docsHref: string;
}) {
  const { permission } = await requirePagePermission("api-keys");

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  const now = new Date();
  const paginated = paginate(
    keys,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Let other software push earnings into this system. Issue one key per
            software — the name is recorded as the source of every earning it
            adds.
          </p>
        </div>
        {permission.canCreate && <ApiKeyDialog />}
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Software</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No API keys yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((key) => (
              <ApiKeyRowActions
                key={key.id}
                id={key.id}
                name={key.name}
                revoked={!!key.revokedAt}
                expired={!!key.expiresAt && key.expiresAt < now}
                canEdit={permission.canEdit}
                canDelete={permission.canDelete}
              >
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {key.keyPrefix}…
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFormat.format(key.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.lastUsedAt ? dateFormat.format(key.lastUsedAt) : "Never"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.expiresAt ? dateFormat.format(key.expiresAt) : "Never"}
                </TableCell>
                <TableCell>
                  {key.revokedAt ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : key.expiresAt && key.expiresAt < now ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </TableCell>
              </ApiKeyRowActions>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          pageSize={paginated.pageSize}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-card p-4 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-sm font-medium">Push an earning</h2>
          <p className="text-sm text-muted-foreground">
            <code>POST /api/v1/earnings</code> — fields, responses, errors and
            examples.
          </p>
        </div>
        <Link
          href={docsHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <BookOpenIcon className="size-4" />
          Read the API docs
        </Link>
      </div>
    </div>
  );
}
