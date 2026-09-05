import { COMPANY_INFO } from "@/lib/invoices/constants";
import { formatInvoiceNumber, INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/invoices/constants";
import { getInvoiceForVerification } from "@/actions/invoices/queries";

export const dynamic = "force-dynamic";

export default async function VerifyInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceForVerification(id);

  return (
    <main className="flex min-h-full grow flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-md bg-card p-6 ring-1 ring-foreground/10">
        <p className="text-center text-sm font-medium text-muted-foreground">
          {COMPANY_INFO.name.toUpperCase()}
        </p>
        <h1 className="mt-1 text-center text-lg font-medium">Invoice verification</h1>

        {!invoice ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            This verification link is invalid or the invoice could not be found.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-3 text-sm">
            <Row label="Client" value={invoice.clientName} />
            <Row label="Invoice No" value={formatInvoiceNumber(invoice.number)} />
            <Row
              label="Status"
              value={<StatusPill status={invoice.status} />}
            />
            <Row label="Issue date" value={formatDate(invoice.issueDate)} />
            <Row label="Due date" value={formatDate(invoice.dueDate)} />
            {invoice.status === "PAID" && (
              <>
                <Row label="Paid on" value={invoice.paidOn ? formatDate(invoice.paidOn) : "—"} />
                <Row label="Transaction ID" value={invoice.transactionId ?? "—"} />
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
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
