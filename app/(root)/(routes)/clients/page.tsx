import { ClientDialog, ClientRowActions } from "@/components/clients/client-dialog";
import { ClientFilterBar } from "@/components/clients/client-filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CLIENT_STATUS_LABELS, type ClientStatus, type PaymentCurrency } from "@/lib/clients/constants";
import { listClients, type SortOption } from "@/actions/clients/queries";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const clients = await listClients({
    search: params.q,
    status: params.status as ClientStatus | undefined,
    sort: params.sort as SortOption | undefined,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Clients</h1>
        <ClientDialog />
      </div>

      <ClientFilterBar />

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
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
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => {
              const entry = {
                id: client.id,
                name: client.name,
                phone: client.phone,
                email: client.email,
                country: client.country,
                currency: client.currency as PaymentCurrency,
                status: client.status as ClientStatus,
              };
              return (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email}</TableCell>
                  <TableCell>{client.country}</TableCell>
                  <TableCell>{client.currency}</TableCell>
                  <TableCell>
                    <StatusPill status={client.status as ClientStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <ClientRowActions entry={entry} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
