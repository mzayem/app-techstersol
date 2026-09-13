import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { formatContractAmount } from "@/lib/contracts/constants";
import { formatInvoiceNumber, INVOICE_STATUS_LABELS } from "@/lib/invoices/constants";
import { getActiveClientProfiles, requireClientUser } from "@/lib/rbac/permissions";
import { listMyInvoices } from "@/actions/client-portal/queries";

export const dynamic = "force-dynamic";

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireClientUser();
  const params = await searchParams;
  const profiles = getActiveClientProfiles(appUser);
  const isMultiProfile = profiles.length > 1;
  const invoices = await listMyInvoices(profiles);
  const paginated = paginate(invoices, parsePageParam(params.page), parsePageSizeParam(params.pageSize));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-medium">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Your invoices, paid and pending. Download a PDF copy any time.
        </p>
      </div>

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              {isMultiProfile && <TableHead>Profile</TableHead>}
              <TableHead>Issue date</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.totalItems === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isMultiProfile ? 7 : 6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
            {paginated.items.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {formatInvoiceNumber(invoice.number)}
                </TableCell>
                {isMultiProfile && (
                  <TableCell className="text-muted-foreground">{invoice.clientName}</TableCell>
                )}
                <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatContractAmount(invoice.balanceDue, invoice.currency)}
                </TableCell>
                <TableCell>
                  <StatusPill status={invoice.status} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Download PDF"
                    render={
                      <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer" />
                    }
                  >
                    <DownloadIcon />
                  </Button>
                </TableCell>
              </TableRow>
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
    </div>
  );
}

function StatusPill({ status }: { status: "UNPAID" | "PAID" }) {
  const isPaid = status === "PAID";
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        (isPaid
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
      }
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
