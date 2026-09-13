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
import { formatContractAmount } from "@/lib/contracts/constants";
import { formatInvoiceNumber, INVOICE_STATUS_LABELS } from "@/lib/invoices/constants";
import { requireClientUser } from "@/lib/rbac/permissions";
import { listMyInvoices } from "@/actions/client-portal/queries";

export const dynamic = "force-dynamic";

export default async function ClientInvoicesPage() {
  const appUser = await requireClientUser();
  const invoices = await listMyInvoices(appUser.client!.id);

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
              <TableHead>Issue date</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {formatInvoiceNumber(invoice.number)}
                </TableCell>
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
