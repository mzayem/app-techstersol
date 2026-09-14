import {
  ClientDialog,
  ClientRowActions,
} from "@/components/clients/client-dialog";
import { ClientFilterBar } from "@/components/clients/client-filter-bar";
import { ExportReportDialog } from "@/components/reports/export-report-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginate, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import {
  CLIENT_STATUS_LABELS,
  type ClientStatus,
  type PaymentCurrency,
} from "@/lib/clients/constants";
import {
  listClients,
  listPartnerOptions,
  type SortOption,
} from "@/actions/clients/queries";
import { requirePagePermission } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { permission } = await requirePagePermission("clients");
  const params = await searchParams;

  const [clients, partnerOptions] = await Promise.all([
    listClients({
      search: params.q,
      status: params.status as ClientStatus | undefined,
      sort: params.sort as SortOption | undefined,
    }),
    listPartnerOptions(),
  ]);
  const paginated = paginate(
    clients,
    parsePageParam(params.page),
    parsePageSizeParam(params.pageSize),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Clients</h1>
        <div className="flex items-center gap-2">
          <ExportReportDialog module="clients" label="clients" />
          {permission.canCreate && (
            <ClientDialog partnerOptions={partnerOptions} />
          )}
        </div>
      </div>

      <ClientFilterBar />

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Currency</TableHead>
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
                  No clients found.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((client) => {
              const entry = {
                id: client.id,
                name: client.name,
                phone: client.phone,
                email: client.email,
                country: client.country,
                currency: client.currency as PaymentCurrency,
                status: client.status as ClientStatus,
                emailNotificationsEnabled: client.emailNotificationsEnabled,
                broughtByPartnerId: client.broughtByPartnerId,
                broughtByPartnerName: client.broughtByPartner?.name ?? null,
                phoneVisibleToPartner: client.phoneVisibleToPartner,
                emailVisibleToPartner: client.emailVisibleToPartner,
              };
              return (
                <ClientRowActions
                  key={client.id}
                  entry={entry}
                  canEdit={permission.canEdit}
                  canDelete={permission.canDelete}
                >
                  <TableCell className="font-medium">
                    {client.name}
                    {client.broughtByPartner && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        via {client.broughtByPartner.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.email}
                  </TableCell>
                  <TableCell>{client.country}</TableCell>
                  <TableCell>{client.currency}</TableCell>
                  <TableCell>
                    <StatusPill status={client.status as ClientStatus} />
                  </TableCell>
                </ClientRowActions>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          pageSize={paginated.pageSize}
        />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ClientStatus }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        (isActive
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground")
      }
    >
      {CLIENT_STATUS_LABELS[status]}
    </span>
  );
}
