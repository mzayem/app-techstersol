import { InvoiceDialog } from "@/components/invoices/invoice-dialog";
import { InvoiceFilterBar } from "@/components/invoices/invoice-filter-bar";
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentCurrency } from "@/lib/clients/constants";
import { formatContractAmount } from "@/lib/contracts/constants";
import {
  formatInvoiceNumber,
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "@/lib/invoices/constants";
import {
  listInvoices,
  listInvoiceSources,
  type SortOption,
} from "@/actions/invoices/queries";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const [invoices, sources] = await Promise.all([
    listInvoices({
      search: params.q,
      status: params.status as InvoiceStatus | undefined,
      sort: params.sort as SortOption | undefined,
    }),
    listInvoiceSources(),
  ]);

  const clients = sources.clients;
  const contracts = sources.contracts.map((c) => ({
    id: c.id,
    clientId: c.clientId,
    projectName: c.projectName,
    currency: c.currency as PaymentCurrency,
    paymentType: c.paymentType as "PROJECT" | "MILESTONE",
    amount: c.amount ? Number(c.amount) : null,
    milestones: c.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      amount: Number(m.amount),
    })),
  }));
  const bankAccounts = sources.bankAccounts.map((b) => ({
    id: b.id,
    currency: b.currency as PaymentCurrency,
    bankName: b.bankName,
    accountHolderName: b.accountHolderName,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Invoices</h1>
        <InvoiceDialog clients={clients} contracts={contracts} bankAccounts={bankAccounts} />
      </div>

      <InvoiceFilterBar />

      <div className="rounded-md bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Bank</TableHead>
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
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
            {invoices.map((invoice) => {
              const currency = invoice.currency as PaymentCurrency;
              const status = invoice.status as InvoiceStatus;
              const total = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {formatInvoiceNumber(invoice.number)}
                  </TableCell>
                  <TableCell>{invoice.client.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.bankAccount.bankName}
                  </TableCell>
                  <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatContractAmount(total, currency)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <InvoiceRowActions
                        id={invoice.id}
                        number={invoice.number}
                        status={status}
                        currency={currency}
                      />
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

function StatusPill({ status }: { status: InvoiceStatus }) {
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
